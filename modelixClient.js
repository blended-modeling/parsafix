const net = require('net');
const readline = require('readline');
const http = require('http');
const fs = require('fs');
const _ = require('lodash');
const { EventEmitter } = require('events');
const crypto = require('crypto');

const tools = require('./tools');
const modSub = require('./modelixSubscription');

//-------------------------------------------------------------------------------
// Modelix client class
//-------------------------------------------------------------------------------
class ModelixClient
{ 
    previousCPVersion = "-1";

    classEmitter;
    debug;

    clientId = null;
    repositoryID = null;
    masterBranchDefault = null;
    masterBranchInfo = null;
    sub = null;

    CPVersion = {};
    editCount;
    CPTree = {};

    apiPath = null;
    apiPayload = null;

    initializing = true;
    initialTreeNodes;
    initialTreeNodeIds;
    buildingTree = false;
    currentTreeModel = null;
    currentNode = null;

    client;

    nodeBitmap = "1";
    nodeOrder = "";
    hamt = {
        "nodes":[]
    };
    currentChildIndex = 2;

    highestID = 0;
    highestMpsID = '1001554027721296255'; //Random number

    parsafixOps = [];
    pendingNewNodeProperties = {};

    constructor(emitter, debug)
    {
        this.client = new net.Socket();
        this.classEmitter = emitter;
        this.debug = debug;
        this.editCount = 0;
        this.initialTreeNodeIds = [];
        this.initialTreeNodes = [];
    }

    //-------------------------------------------------------------------------------
    // Stop the Modelix client
    //-------------------------------------------------------------------------------
    stop()
    {
        try 
        {
            this.client.destroy();
            this.sub.stop();
        } 
        catch (error) {}    
    }

    //-------------------------------------------------------------------------------
    // Start the Modelix client
    //-------------------------------------------------------------------------------
    start()
    {
        //-------------------------------------------------------------------------------
        // When we've connected to the model server
        //-------------------------------------------------------------------------------
        this.client.connect(28101, "localhost", function() 
        {
            console.log("\nConnected to model server.");

            //Start the Modelix session
            this.handleModelixSession();
        }.bind(this));

        //-------------------------------------------------------------------------------
        // When the connection to the model server is closed
        //-------------------------------------------------------------------------------
        this.client.on("close", function() {
            console.log("\nConnection to model server closed.");
        });

        //-------------------------------------------------------------------------------
        // When we receive data from the model server
        //-------------------------------------------------------------------------------
        this.client.on("data", function(data) 
        {
            //this.log(data.toString('utf-8'));
            var res = this.httpResponseToJSON(data.toString('utf-8'));
            this.log("\nReceived " + data.length + " bytes\n" + data.toString('utf-8'));//);JSON.stringify(res));
            //console.log("Received " + data.length + " bytes\n" + JSON.stringify(res));

            //Handle the incoming data
            this.handleModelixSession(res);
        }.bind(this));
    }

    //-------------------------------------------------------------------------------
    // Handles the Modelix session
    //-------------------------------------------------------------------------------
    handleModelixSession(res)
    {
        var httpType = '';

        //Initially we're trying to get the tree hash of the branch we're interested in (default)
        //Once we have the tree hash, requesting it will give us the internal node (HAMT) of the tree (containing hashes of leaf nodes and potential internal nodes)

        //Based on the API path we requested
        switch (this.apiPath) {
            //We requested the client ID
            case '/counter/clientId':
                this.clientId = res['Payload'];

                //Get the repository ID
                httpType = 'GET';
                this.apiPath =  '/get/repositoryId';
                break;

            //We requested the repository ID
            case '/get/repositoryId':
                this.repositoryId = res['Payload'];

                //Get the master branch info
                httpType = 'GET';
                this.apiPath = '/get/branch_default_master';
                break;
                
            //We requested master branch info
            case '/get/branch_default_master':
                this.masterBranchDefault = res['Payload'];
                console.log("Master branch default response: " + JSON.stringify(this.masterBranchDefault));

                if (this.masterBranchDefault.length > 0)
                {
                    //Get the master branch content
                    httpType = 'PUT';
                    this.apiPath = '/getAll';
                    this.apiPayload = '["' + this.masterBranchDefault + '"]';
                }
                else
                {
                    console.log("\nERROR: default master branch request returned empty. Only known fix: restart Modelix and MPS.");
                    return;
                }
                break;

            //We requested data
            case '/getAll':
                this.handleMasterBranch(res['Payload'])
                return;

            //Initially request the client ID
            default:
                httpType = 'POST';
                this.apiPath = '/counter/clientId';
                break;
        }

        //Send the request
        this.client.write(this.httpRequest(httpType, this.apiPath, this.apiPayload));
    }

    //-------------------------------------------------------------------------------
    // Handles master branch data
    //-------------------------------------------------------------------------------
    handleMasterBranch(data)
    {
        console.log("\nIncoming data: " + JSON.stringify(data));

        if (!this.isValidHash(data)) 
        {
            var dataJSON = '';

            try 
            {
                dataJSON = JSON.parse(data.substr(1, data.length - 2));
            } 
            catch (error) 
            {
                return;
            }

            //If we're not yet building the tree, but initializing
            if (this.initializing)
            {
                switch (dataJSON["key"]) 
                {
                    //We've received the branch info
                    case this.masterBranchDefault:
                        //Get the tree
                        this.constructCPVersion(dataJSON);
                        //If this is not a duplicate update
                        if (this.CPVersion != this.previousCPVersion)
                        {
                            this.previousCPVersion = _.cloneDeep(this.CPVersion);
                            this.apiPayload = '["' + this.CPVersion["treeHash"] + '"]';
                            this.client.write(this.httpRequest('PUT', '/getAll', this.apiPayload));
                        }
                        break;
                    //We've received the tree hash
                    case this.CPVersion["treeHash"]:
                        //Get the ID to hash
                        this.constructCPTree(dataJSON);
                        this.apiPayload = '["' + this.CPTree["idToHash"] + '"]';
                        this.client.write(this.httpRequest('PUT', '/getAll', this.apiPayload));
                        break;
                    //We've received the root node
                    case this.CPTree["idToHash"]:
                        //We'll start building the tree
                        this.createTree(this.CPTree, dataJSON, this.CPTree["idToHash"]);
                        break;
                
                    default:
                        this.log("\nUnknown request: " + dataJSON["key"]);
                        break;
                }
            }
            //If we're building a tree
            else if (this.buildingTree)
            {
                this.collectTreeData(dataJSON);
            }
            //If we're being notified of a change operation or receiving a ping message
            else
            {
                //If this is default branch update
                if (dataJSON["value"].startsWith("default/1/"))
                {
                    this.client.write(this.httpRequest('PUT', '/getAll', '["' + dataJSON["value"].split('/')[2] + '"]'));
                }
                //If this is an internal node
                else if (dataJSON["value"].startsWith("I/"))
                {
                    //Store the node order
                    this.getCPHamtInternal(dataJSON["value"].split('/'));
                }
                else
                {
                    //Construct the new CPVersion
                    this.constructCPVersion(dataJSON);
                    //If this is not a duplicate update
                    if (this.CPVersion != this.previousCPVersion)
                    {
                        this.previousCPVersion = _.cloneDeep(this.CPVersion);
                        console.log("\nNew: " + this.CPVersion["id"] + ", arr: " + JSON.stringify(this.parsafixOps));
                        console.log(this.CPVersion);
                        console.log(JSON.stringify(this.hamt));
                        
                        //Perform the operation
                        for (let i = 0; i < this.CPVersion["ops"].length; i++) 
                        {
                            this.handleOperation(this.CPVersion["ops"][i]);
                        }

                        //Ask for new node order
                        console.log("\nAsking for node order. Internal node hash: " + this.hamt["hash"]);
                        this.client.write(this.httpRequest('PUT', '/getAll', ('["' + this.CPVersion["treeHash"] + '"]')));
                    }
                } 
            }
        } 
        else
        {      
            //It's a ping message
        }
    }

    //-------------------------------------------------------------------------------
    // Handles CPVersion data
    //-------------------------------------------------------------------------------
    constructCPVersion(dataJSON)
    {
        var parts = dataJSON["value"].split('/');

        //this.log("\nParts: " + parts.length);

        if (parts.length == 9)
        {
            this.CPVersion["id"] = parts[0]
            this.CPVersion["timestamp"] = unescape(parts[1]);
            this.CPVersion["author"] = unescape(parts[2]);
            this.CPVersion["treeHash"] = parts[3];
            this.CPVersion["baseVersion"] = parts[4];
            this.CPVersion["mergedVersion1"] = parts[5];
            this.CPVersion["mergedVersion2"] = parts[6];
            this.CPVersion["numberOfOperations"] = parseInt(parts[7]);
            this.CPVersion["ops"] = parts[8].split(',');

            this.CPVersion["key"] = dataJSON["key"]

            this.log("\nCPVersion:" + JSON.stringify(this.CPVersion));

            //Update the highest ID if applicable
            if (parseInt(this.CPVersion["id"], 16) > parseInt(this.highestID, 16))
            {
                this.log("New highest ID: " + this.CPVersion["id"]);
                this.highestID = this.CPVersion["id"];
            }

            return this.CPVersion;
        }
        else
        {
            this.log("\nCPVersion parts mismatch");
        }
    }

    //-------------------------------------------------------------------------------
    // Handles CPTree data
    //-------------------------------------------------------------------------------
    constructCPTree(dataJSON)
    {
        var parts = dataJSON["value"].split('/');

        if (parts.length == 3)
        {
            this.CPTree["id"] = parts[0];
            this.CPTree["rootId"] = parseInt(parts[1]);
            this.CPTree["idToHash"] = parts[2];

            this.log("\nCPTree; ID: " + this.CPTree["id"] + ', rootID: ' + this.CPTree["rootId"] + ', idToHash: ' + this.CPTree["idToHash"]);

            return this.CPTree;
        }
        else
        {
            this.log("\nCPTree parts mismatch");
        }
    }

    //-------------------------------------------------------------------------------
    // Creates a CPTree
    //-------------------------------------------------------------------------------
    createTree(treeInfo, rootJSON, idToHash)
    {
        //We've starting building a tree
        this.initializing = false;
        this.buildingTree = true;

        var model = {};
        var rootId = treeInfo["rootId"];
        model["id"] = "0";
        model["parentId"] = null;
        this.initialTreeNodeIds = this.getCPHamtNode(rootJSON)[1];
        model["children"] = [];
        
        this.currentTreeModel = model;
        this.currentNode = model;

        this.log("\nInitial tree: " + JSON.stringify(this.currentTreeModel));

        //If the root has children
        if (Array.isArray(this.initialTreeNodeIds))
        {
            //Request data for the first node
            this.apiPayload = '["' + _.cloneDeep(this.initialTreeNodeIds[0]) + '"]';
            this.initialTreeNodeIds.shift();
            this.client.write(this.httpRequest('PUT', '/getAll', this.apiPayload));
        }
        else
        {
            this.log("The tree has no children");
        }
    }

    //-------------------------------------------------------------------------------
    // Collects the tree data recursively based on given JSON
    //-------------------------------------------------------------------------------
    collectTreeData(dataJSON)
    {        
        //Get the node data
        var cpHamtNode = this.getCPHamtNode(dataJSON);
        var nodeData = cpHamtNode[1];

        switch (cpHamtNode[0]) {
            case "CPHamtLeaf":
                //Create the new node
                var newNode = {
                    "leafHash": dataJSON["key"],
                    "nodeHash": nodeData[0],
                    "children": []
                }

                this.currentNode = newNode;

                //Get the node content
                this.apiPayload = '["' + nodeData[0] + '"]';
                this.client.write(this.httpRequest('PUT', '/getAll', this.apiPayload));
                break;
            case "CPHamtInternal": //This only happens if the HAMT already contains internal nodes
                //Get the contents of the internal node
                var parts = dataJSON["value"].split('/');
                var hashes = parts[2].split(',');

                this.initialTreeNodeIds = this.initialTreeNodeIds.concat(hashes);

                //Get the next node
                var nextNode = _.cloneDeep(this.initialTreeNodeIds[0]);
                this.initialTreeNodeIds.shift();
                this.apiPayload = '["' + nextNode + '"]';
                this.client.write(this.httpRequest('PUT', '/getAll', this.apiPayload));
                break;
            case "CPNode":
                this.currentNode["data"] = nodeData;

                this.initialTreeNodes.push(_.cloneDeep(this.currentNode));

                //Get the next node
                if (this.initialTreeNodeIds.length > 0)
                {
                    var nextNode = _.cloneDeep(this.initialTreeNodeIds[0]);
                    this.initialTreeNodeIds.shift();
                    this.apiPayload = '["' + nextNode + '"]';
                    this.client.write(this.httpRequest('PUT', '/getAll', this.apiPayload));
                }
                else
                {
                    //Take the nodes we got and built the tree
                    this.buildTree(this.currentTreeModel);

                    //We're done
                    this.log("\nInitial tree complete!");
                    this.buildingTree = false;

                    //Emit the data to be parsed
                    this.classEmitter.emit('data', _.cloneDeep(this.currentTreeModel));

                    //Subscribe to the tree to be informed of changes
                    var subListener = new EventEmitter();
                    this.sub = new modSub.ModelixSubscription(subListener);
                    subListener.on("data", function(data)
                    {
                        var res = this.httpResponseToJSON(data.toString('utf-8'));
                        this.log("\nSubscription data (" + data.length + " bytes)\n" + JSON.stringify(res));
                        this.handleSubscription(res);
                    }.bind(this));
                    this.sub.subscribe('branch_default_master');
                }
                break;
        
            default:
                break;
        }
    }

    //-------------------------------------------------------------------------------
    // Builds the tree model by assigning the right children to the right parents
    //-------------------------------------------------------------------------------
    buildTree()
    {
        var leafArr = [];
        var nodeArr = _.cloneDeep(this.initialTreeNodes);

        //Find the leaf nodes (nodes without children)
        for (let i = 0; i < nodeArr.length; i++) 
        {
            var nodeData = nodeArr[i]["data"]

            if (nodeData["childrenIds"].length == 1 && nodeData["childrenIds"][0].length == 0)
            {
                leafArr.push(_.cloneDeep(nodeArr[i]));
            }
        }

        //Give them their parents
        var treeArr = this.assignParents(leafArr, [], 0);
        this.currentTreeModel["children"] = treeArr;
    }

    //-------------------------------------------------------------------------------
    // Give parent nodes their rightful children
    //-------------------------------------------------------------------------------
    assignParents(childArr, parentArr, nodeCount)
    {
        //Loop through the children
        for (let i = 0; i < childArr.length; i++) 
        { 
            var nodeData = childArr[i]["data"]

            //Find this child's parent
            var parentNode;
            for (let j = 0; j < this.initialTreeNodes.length; j++) 
            {
                if (this.initialTreeNodes[j]["data"]["id"] == nodeData["parentId"])
                {
                    parentNode = _.cloneDeep(this.initialTreeNodes[j]);
                    //console.log("Parent: " + parentNode["data"]["id"]);
                }
            }

            //Assign the child to its parent
            childArr[i]["parentId"] = parentNode["id"];

            //Check if we've found this parent before
            var parentPresent = false;
            for (let j = 0; j < parentArr.length; j++) 
            {
                var foundParent = tools.findInTree(parentArr[j], ["data", "id"], nodeData["parentId"]);

                if (foundParent != null)
                {
                    parentPresent = true;
                    parentNode = foundParent;
                    break;
                }
            }
            if (!foundParent)
            {
                for (let j = 0; j < childArr.length; j++) 
                {
                    if (childArr[j]["data"]["id"] != nodeData["id"])
                    {
                        var foundParent = tools.findInTree(childArr[j], ["data", "id"], nodeData["parentId"]);

                        if (foundParent != null)
                        {
                            parentPresent = true;
                            parentNode = foundParent;
                            break;
                        }
                    }
                }
            }

            //If the parent has already been added
            if (parentPresent)
            {
                //Just add the child to its list
                parentNode["children"].push(childArr[i]);
            }
            //If this is a new parent
            else
            {
                //Create it
                parentNode["children"] = [childArr[i]];
                parentArr.push(parentNode);
            }

            nodeCount++;
        }

        //Loop through the parents
        for (let i = 0; i < parentArr.length; i++) 
        {
            
            var nodeData = parentArr[i]["children"][0]["data"]

            //Check if the current parent is the child of any other parent
            for (let j = 0; j < parentArr.length; j++) 
            {
                if (j != i)
                {
                    var foundParent = tools.findInTree(parentArr[j], ["data", "id"], nodeData["parentId"]);

                    if (foundParent != null)
                    {
                        if (!foundParent.hasOwnProperty("children"))
                        {
                            foundParent["children"] = [];
                        }

                        foundParent["children"].push(parentArr[i]);

                        parentArr.splice(i, 1);
                        i = -1;
                    }                
                }
            }
        }

        //If we haven't been through all the nodes yet
        if (nodeCount < this.initialTreeNodes.length - 1)
        {
            //Continue assigning one level higher
            return this.assignParents(parentArr, [], nodeCount);
        }
        else
        {
            return parentArr;
        }
    }

    //-------------------------------------------------------------------------------
    // Returns node data of a CPHamt node
    //-------------------------------------------------------------------------------
    getCPHamtNode(dataJSON)
    {
        var parts = dataJSON["value"].split('/');

        //CPLeaf node
        if (parts[0] == 'L')
        {
            return ["CPHamtLeaf", this.getCPHamtLeaf(parts)];
        }
        //CPInternal node
        else if (parts[0] == 'I')
        {
            return ["CPHamtInternal", this.getCPHamtInternal(parts)];
        }
        //CPNode
        else if (parts.length == 7)
        {
            return ["CPNode", this.getCPNode(parts)];
        }
        else
        {
            this.log("\nCPHamtNode parts mismatch: " + JSON.stringify(dataJSON));
        }
    }

    //-------------------------------------------------------------------------------
    // Returns the data of a CPHamtLeaf node
    //-------------------------------------------------------------------------------
    getCPHamtLeaf(parts)
    {
        var key = parts[1];
        var value = parts[2];

        this.log("\nLeaf: " + key + ': ' + value);

        return [value];
    }

    //-------------------------------------------------------------------------------
    // Returns all the children of a CPHamtInternal node
    //-------------------------------------------------------------------------------
    getCPHamtInternal(parts)
    {
        var bitmap = parts[1];
        var children = parts[2].split(',');

        this.nodeBitmap = bitmap;     

        //Save the new node order
        this.nodeOrder = _.cloneDeep(parts[2]);
        
        //If this is the first time we're building the project's internal node
        if (!this.hamt.hasOwnProperty("bitmap"))
        {
            //Copy the internal node we received
            for (let i = 0; i < children.length; i++) 
            {
                this.hamt["nodes"].push({"hash":children[i]})
            }
            this.hamt["bitmap"] = bitmap;
            this.hamt["hash"] = tools.getInternalNodeHash(this.hamt);
        }        

        this.log("Node order (" + bitmap + "): " + JSON.stringify(children));
        console.log("\nNode order, bitmap: ", bitmap);
        console.log(JSON.stringify(children));
        console.log("Custom order: ")
        console.log(this.hamt);
        
        return children;
    }

    //-------------------------------------------------------------------------------
    // Returns the data of a CP node
    //-------------------------------------------------------------------------------
    getCPNode(parts)
    {
        var CPNode = {};

        CPNode["id"] = parts[0];
        CPNode["concept"] = unescape(parts[1]);
        CPNode["parentId"] = parts[2];
        CPNode["roleInParent"] = unescape(parts[3]);
        CPNode["childrenIds"] = parts[4].split(',');
        CPNode["properties"] = parts[5].split(',');
        CPNode["references"] = parts[6].split(',');

        //Update the highest ID if applicable
        if (parseInt(CPNode["id"], 16) > parseInt(this.highestID, 16))
        {
            this.log("New highest ID: " + CPNode["id"]);
            this.highestID = CPNode["id"];
        }

        //Look at the properties
        for (let i = 0; i < CPNode["properties"].length; i++) 
        {
            //Get the MPS node ID property
            if (CPNode["properties"][i].indexOf("mpsNodeId") > -1)
            {
                var keyVal = CPNode["properties"][i].split('=')

                //If this is the highest MPS ID we've seen
                if (tools.compareLong(keyVal[1], this.highestMpsID) == 1)
                {
                    //Save it
                    this.log("New highest MPS ID: " + keyVal[1]);
                    this.highestMpsID = keyVal[1];
                }
            }
        }

        this.log("\nNode:");
        this.log(CPNode);

        return CPNode;
    }

    //-------------------------------------------------------------------------------
    // Returns true if the given hash is a valid SHA-256 hash
    //-------------------------------------------------------------------------------
    isValidHash(hash)
    {
        const sha256_regex = /^[a-zA-Z0-9\-_]{5}\*[a-zA-Z0-9\-_]{38}$/;
        return sha256_regex.test(hash);
    }

    //-------------------------------------------------------------------------------
    // Handles a given operation
    //-------------------------------------------------------------------------------
    handleOperation(op)
    {
        var parts = op.split(';');
        //console.log("Operation: " + op);
        var opType = parts[0];
        var nodeId = parts[1];

        var nodeIdToSend = nodeId;

        switch (opType)
        {   
            case 'AddNewChildOp':
                this.handleAddNewChildOp(parts, this.parsafixOps.indexOf(this.CPVersion["id"] + '_' + this.CPVersion["treeHash"]) > -1);
                nodeIdToSend = parts[4];
                break;
            case 'DeleteNodeOp':
                this.handleDeleteNodeOp(parts, this.parsafixOps.indexOf(this.CPVersion["id"] + '_' + this.CPVersion["treeHash"]) > -1);
                break;
            case 'MoveNodeOp':
                this.handleMoveNodeOp(parts);
                break;
            case 'NoOp':
                break;
            case 'SetPropertyOp':
                this.handleSetPropertyOp(parts, this.parsafixOps.indexOf(this.CPVersion["id"] + '_' + this.CPVersion["treeHash"]) > -1);
                break;
            case 'SetReferenceOp':
                this.handleSetReferenceOp(parts);
                break;
            case 'UndoOp':
                this.handleUndoOp(parts);
                break;

            default:
                this.log("\nUnknown operation: " + parts[0]);
        }

        //If this operation was NOT received from Parsafix
        if (this.parsafixOps.indexOf(this.CPVersion["id"] + '_' + this.CPVersion["treeHash"]) == -1)
        {
            //Emit the data to be parsed
            this.classEmitter.emit('data', _.cloneDeep(this.currentTreeModel), opType, nodeIdToSend, op);
        }
    }

    //-------------------------------------------------------------------------------
    // Adds a new child
    //-------------------------------------------------------------------------------
    handleAddNewChildOp(parts, fromParsafix)
    {
        var nodeId = parts[1]
        var role = unescape(parts[2]);
        var index = parseInt(parts[3]);
        var childId = parts[4];
        var concept = unescape(parts[5]);

        //Update the highest ID if applicable
        if (parseInt(childId, 16) > parseInt(this.highestID, 16))
        {
            this.log("New highest ID: " + childId);
            this.highestID = childId;
        }

        //Find parent node
        var parentNode = tools.findInTree(this.currentTreeModel, ["data", "id"], nodeId);
        if (!parentNode["data"].hasOwnProperty("childrenIds"))
        {
            parentNode["data"]["childrenIds"] = [];
        }

        //If the child truly does not yet exist (it shouldn't)
        if (!parentNode["data"]["childrenIds"].includes(childId))
        {
            var nodeIdProp = '';
            //Get the new child's node ID
            for (let i = 0; i < this.CPVersion["ops"].length; i++) 
            {
                if (this.CPVersion["ops"][i].indexOf("mpsNodeId") > -1)
                {
                    var tempSplit = this.CPVersion["ops"][i].split(';');
                    nodeIdProp = tempSplit[2] + '=' + tempSplit[3];

                    //If this is the highest MPS ID we've seen
                    if (tools.compareLong(tempSplit[3], this.highestMpsID) == 1)
                    {
                        //Save it
                        this.log("New highest MPS ID: " + tempSplit[3]);
                        this.highestMpsID = tempSplit[3];
                    }
                }
            }

            var nodeString = childId + "/" + encodeURIComponent(concept) + "/" + nodeId + "/" + role + "//" + nodeIdProp + "/";
            var nodeHash = tools.hash(nodeString);
            var leafHash = tools.hash("L/" + childId + "/" + nodeHash);

            //Create the new child node
            var newChild = {
                "leafHash":leafHash, 
                "nodeHash":nodeHash,
                "children": [],
                "data":
                {
                    id: childId,
                    parentId: parentNode["data"]["id"],
                    roleInParent: role,
                    concept: concept,
                    properties: [nodeIdProp],
                    references: [],
                    childrenIds: [],
                    index: index
                },
                "baseVersion": _.cloneDeep(this.CPVersion["key"])
            }
            
            //Add it to the tree
            parentNode["data"]["childrenIds"].push(childId);

            //Update the parent hashes
            var newParentNodeHash = tools.hash(this.constructNodeString(this.currentTreeModel, parentNode["data"]["id"]));
            var newParentLeafHash = tools.hash("L/" + parentNode["data"]["id"] + "/" + newParentNodeHash);

            //If we haven't done so already
            if (!fromParsafix)
            {
                //Update the internal node
                tools.put(childId, 0, this.hamt, newChild["leafHash"], []);
                tools.updateInternalNode(this.hamt, parentNode["leafHash"], newParentLeafHash);
            }

            parentNode["nodeHash"] = newParentNodeHash;
            parentNode["leafHash"] = newParentLeafHash;

            if (!parentNode.hasOwnProperty("children"))
            {
                parentNode["children"] = [];
            }
            parentNode["children"].push(newChild);
        }
    }

    //-------------------------------------------------------------------------------
    // Deletes a node
    //-------------------------------------------------------------------------------
    handleDeleteNodeOp(parts, fromParsafix)
    {
        var nodeId = parts[1];

        var nodeToDelete = tools.findInTree(this.currentTreeModel, ["data", "id"], nodeId);

        //If the node still exists
        if (nodeToDelete != null)
        {
            var nodeData = nodeToDelete["data"];

            var parentNode = tools.findInTree(this.currentTreeModel, ["data", "id"], nodeData["parentId"]);

            //Remove the node from the parent's list of children
            parentNode["data"]["childrenIds"].splice(parentNode["data"]["childrenIds"].indexOf(nodeId), 1);

            //Update the parent hashes
            var newParentNodeHash = tools.hash(parentNode["data"]["id"]);
            var newParentLeafHash = tools.hash("L/" + parentNode["data"]["id"] + "/" + newParentNodeHash);

            //If we haven't done so already
            if (!fromParsafix)
            {
                //Update the internal node
                tools.put(nodeId, 0, this.hamt, []);
                console.log("Parent hash: " + parentNode["leafHash"] + " -> " + newParentLeafHash);
                tools.updateInternalNode(this.hamt, parentNode["leafHash"], newParentLeafHash);
            }

            parentNode["nodeHash"] = newParentNodeHash;
            parentNode["leafHash"] = newParentLeafHash;

            //Remove the node
            parentNode["children"].splice(parentNode["children"].indexOf(nodeToDelete), 1);
        }
    }

    //-------------------------------------------------------------------------------
    // Move a node
    //-------------------------------------------------------------------------------
    handleMoveNodeOp(parts)
    {
        var nodeId = parts[1]
        var parentId = parts[2];
        var role = parts[3];
        var index = parts[4]
        
        //Find the node
        var node = tools.findInTree(this.currentTreeModel, ["data", "id"], nodeId);
        
        //Update the index
        if (node != null)
        {
            node["data"]["index"] = index;
        }
    }

    //-------------------------------------------------------------------------------
    // Sets a property
    //-------------------------------------------------------------------------------
    handleSetPropertyOp(parts, fromParsafix)
    {
        var nodeId = parts[1]
        var role = unescape(parts[2]);
        var value = parts[3];

        //If we're not setting the node ID (this is done whenever a node is added, see handleAddNewChildOp)
        if (role != "#mpsNodeId#")
        {
            this.log("\nSET PROPERTY\n-------------\nNode ID: " + nodeId + "\nRole: " + role + "\nValue: " + value);

            var changedNode = tools.findInTree(this.currentTreeModel, ["data", "id"], nodeId);

            //If this node exists (it should, but sometimes add node operations don't come through correctly)
            if (changedNode != null)
            {
                var nodeData = changedNode["data"];
                var props = nodeData["properties"];
                nodeData["baseVersion"] = _.cloneDeep(this.CPVersion["key"]);

                var propertySet = false;

                for (let i = 0; i < props.length; i++) 
                {
                    var keyVal = props[i].split('=');
                    //If this is the property we're looking for
                    if (keyVal[0] == role)
                    {
                        //Replace its value
                        props[i] = keyVal[0] + '=' + value;
                        propertySet = true;
                    }
                }

                //If the property is new
                if (!propertySet)
                {
                    //Add it
                    props.push(role + '=' + value);
                }

                //Update the hashes
                var newNodeHash = tools.hash(this.constructNodeString(this.currentTreeModel, nodeId));
                var newLeafHash = tools.hash("L/" + nodeId + "/" + newNodeHash);

                //If we haven't done so already
                if (!fromParsafix)
                {
                    //Update the internal node
                    tools.updateInternalNode(this.hamt, changedNode["leafHash"], newLeafHash);
                }

                changedNode["nodeHash"] = newNodeHash;
                changedNode["leafHash"] = newLeafHash;
            }
            else
            {
                //We'll assume the add node operations for this node didn't come through correctly
                this.log("Node '" + nodeId + "' wasn't added properly. We're missing the MPS node ID. Leaving it alone.");
            }
        }

        //If this node still needs to be given a value (it was added by Parsafix)
        if (this.pendingNewNodeProperties.hasOwnProperty(nodeId))
        {
            //Set the property
            this.setNodeProperty(nodeId, _.cloneDeep(this.pendingNewNodeProperties[nodeId]["property"]), _.cloneDeep(this.pendingNewNodeProperties[nodeId]["value"]), true);

            if (role != "#mpsNodeId#")
            { 
                //Remove it from the list
                delete this.pendingNewNodeProperties[nodeId];
            }
        }
    }

    //-------------------------------------------------------------------------------
    // Sets a reference
    //-------------------------------------------------------------------------------
    handleSetReferenceOp(parts)
    {
        var sourceId = parts[1]
        var role = unescape(parts[2]);
        var target = parts[3];

        var sourceNode = tools.findInTree(this.currentTreeModel, ["data", "id"], sourceId["data"]);

        if (sourceNode != null)
        {
            if (!sourceNode.hasOwnProperty("references"))
            {
                sourceNode["references"] = [];
            }

            if (!sourceNode["references"].includes(target))
            {
                sourceNode["references"].push(role + '=' + target);
            }
        }
    }

    //-------------------------------------------------------------------------------
    // Undo operation
    //-------------------------------------------------------------------------------
    handleUndoOp(parts)
    {
        var undoHash = parts[1];

        //Ask the server for the operation details
        this.client.write(this.httpRequest('PUT', '/getAll', ('["' + undoHash + '"]')));
    }

    //-------------------------------------------------------------------------------
    // Builds a HTTP request based on the given parameters
    //-------------------------------------------------------------------------------
    httpRequest(type, path, payload, subscription)
    {
        var httpString = type + ' ' + path + ' HTTP/1.1\r\n' +
        'Host: localhost:28101\r\n' +
        'Connection: keep-alive\r\n' +
        'Authorization: Bearer null\r\n' +
        'User-Agent: Jersey/2.31 (HttpUrlConnection 11.0.6)\r\n';
        
        switch (type) {
            case 'GET':    
                break;
            case 'PUT':
                if (payload != null)
                {
                    httpString += 'Accept: application/json\r\n' + 
                    'Content-Type: text/plain\r\n' +
                    'Content-Length: ' + payload.length + '\r\n' +
                    '\r\n' +
                    payload;
                }
                else
                {
                    this.log("HTTP PUT missing payload");
                }
                break;
            case 'POST':
                break;
        
            default:
                this.log("Invalid HTTP request type: " + type);
        }

        if (subscription != null)
        {
            httpString += 'Accept: text/event-stream\r\n';
        }

        httpString += '\r\n'

        this.log('\nSending:\n' + httpString);
        return httpString;
    }

    //-------------------------------------------------------------------------------
    // Converts a HTTP response string to JSON
    //-------------------------------------------------------------------------------
    httpResponseToJSON(res)
    {
        //The HTTP response string's parts are seperated by '\r\n'
        var headerArr = res.split('\r\n');
        var resJSON = {};

        //Loop through the headers
        for (let i = 0; i < headerArr.length; i++) 
        {
            //If the 'header' starts with a '[' it is the response payload as an array
            if (headerArr[i][0] == '[')
            {
                resJSON['Payload'] = headerArr[i];
                continue;
            }

            //The typical structure is <header key>:<value>
            var keyValArr = headerArr[i].split(':');

            //However, if this header has no key
            if (keyValArr.length == 1)
            {
                //Assume it's the server status if it contains the HTTP version
                if (keyValArr[0].indexOf('HTTP/1.1') > -1)
                {
                    resJSON['Status'] = keyValArr[0];
                }
                //Otherwise assume it's the response payload
                else
                {
                    resJSON['Payload'] = keyValArr[0];
                }
            }
            //If there is a key, map it to JSON
            else
            {
                resJSON[keyValArr[0]] = keyValArr[1].trim();
            }
        }

        return resJSON;
    }

    //-------------------------------------------------------------------------------
    // Ask for the change when the model server notifies us about a change
    //-------------------------------------------------------------------------------
    handleSubscription(res)
    {
        if (res.hasOwnProperty("data"))
        {
            //If this is a valid hash
            if (this.isValidHash(res["data"]))
            {
                //Send it back to request the change data
                this.client.write(this.httpRequest('PUT', '/getAll', ('["' + res["data"] + '"]')));
            }
            else
            {
                var keyValArr = res["data"];
                for (let i = 0; i < keyValArr.length; i++) 
                {
                    var keyValJSON = JSON.parse(keyValArr[i]);
                    var key = keyValJSON["key"];
                    var val = keyValJSON["value"];

                    this.log("\nKey: " + key + "\nVal: " + val);
                }
            }
        }
        else
        {
            //Get tree info as ping message
            this.client.write(this.httpRequest('GET', '/get/branch_default_master'));
        }
    }

    //-------------------------------------------------------------------------------
    // Helper function that prints details we care about
    //-------------------------------------------------------------------------------
    printDetails()
    {
        this.log(this.CPTree);
    }

    //-------------------------------------------------------------------------------
    // Handles an edit received from Parsafix
    //-------------------------------------------------------------------------------
    handleParsafixEdit(data)
    {
        console.log("\nMPS received a Parsafix edit: " + JSON.stringify(data));

        var opType = data["opType"];

        switch (opType)
        {   
            case 'insertOp':
                //If we need to add a new child
                if (data["isNewElement"])
                {
                    console.log("Adding MPS node:", data["parentId"], this.getRoleString(data["concept"]), this.getConceptString(data["concept"]), data["isRootNode"]);
                    //First we add the new node
                    this.addNewNode(data["parentId"], this.getRoleString(data["concept"]), this.getConceptString(data["concept"]), data["isRootNode"], true, data["spoofax_line_index"], data["modelId"], function(nodeId)
                    {
                        //If it was immediately given a property
                        if (data.hasOwnProperty("property"))
                        {
                            //Wait for the node to be added to give it its property
                            this.pendingNewNodeProperties[nodeId] = {
                                "property":data["property"], 
                                "value":data[data["property"]],
                                "propertyAssigned":false
                            };
                        }
                    }.bind(this));
                }
                //If this is a property edit
                else
                {
                    var propValue = tools.sarosToMpsText(data[data["property"]]);
                    console.log("Setting MPS node property:", data["nodeId"], data["property"], propValue);

                    var curProps = tools.getMpsNodeProperties(data["nodeId"]);
                    if (curProps[data["property"]] != propValue)
                    {
                        console.log("Setting MPS node property:", data["nodeId"], data["property"], propValue);
                        this.setNodeProperty(data["nodeId"], data["property"], propValue, true);
                    }
                    else
                    {
                        console.log("Node already has property set to this value:", data["nodeId"], data["property"], propValue);
                    }
                }
                break;
            case 'deleteOp':
                this.deleteNode(data["nodeId"], true);
                break;
        }       
    }

    //-------------------------------------------------------------------------------
    // Add a new node
    //-------------------------------------------------------------------------------
    addNewNode(parentId, role, concept, newRoot, fromParsafix, spoofaxLineIndex, modelId, callback)
    {
        var JsonArr = [];

        //Get the parent node
        var parentNode = tools.findInTree(this.currentTreeModel, ["data", "id"], parentId);

        var baseVersion = this.CPVersion["key"];
        //If the parent has a base version (this is the case if we're not adding a new root node)
        if (parentNode["data"].hasOwnProperty("baseVersion"))
        {
            //Use that instead
            baseVersion = parentNode["data"]["baseVersion"];
            //Base version = the hash of previous operation for the parent node

            //What to do if Parsafix joins the session with nodes already in existence?
            //Ignoring that for now
        }

        //Generate a child ID (upping the current highest ID by a certain amount)
        this.highestID = tools.upVersion(this.highestID, 1);
        var childId = _.cloneDeep(this.highestID);

        //Generate an MPS ID for the new node
        this.highestMpsID = tools.upLong(tools.upLong(this.highestMpsID));
        this.log("New highest MPS ID: " + this.highestMpsID);

        var newChildNodeString = childId + "/" + encodeURIComponent(concept) + "/" + parentId + "/" + role + "//%23mpsNodeId%23=" + this.highestMpsID + "/";
        var newChildLeaf = "L/" + childId + "/" + tools.hash(newChildNodeString);

        //Get the parent's children as a string
        var childrenString = this.getChildrenString(parentNode);
        //Add the new child to it
        if (childrenString.length > 0)
        {
            childrenString += ',';
        }
        childrenString += childId;

        var parentNodeString = parentId + "/" + encodeURIComponent(parentNode["data"]["concept"]) + "/" + parentNode["data"]["parentId"] + "/" + parentNode["data"]["roleInParent"] + "/" + childrenString + "/" + this.getPropertiesString(parentNode) + "/" + this.getReferencesString(parentNode);
        var updatedParentLeaf = "L/" + parentId + "/" + tools.hash(parentNodeString);

        //Create an array to keep track of what internal nodes are being added to the HAMT when we add a new child
        var updatedInternalNodesArr = [];
        tools.put(childId, 0, this.hamt, tools.hash(newChildLeaf), updatedInternalNodesArr);
        tools.updateInternalNode(this.hamt, parentNode["leafHash"], tools.hash(updatedParentLeaf), updatedInternalNodesArr);
        var internalNode = tools.getInternalNodeString(this.hamt);

        //If by adding the new node we've created a new internal node, 
        if (updatedInternalNodesArr.length > 0)
        {
            console.log("\nInternal nodes were added/updated during put()");
            console.log(JSON.stringify(updatedInternalNodesArr));

            //We need to tell Modelix about it
            for (let i = 0; i < updatedInternalNodesArr.length; i++) 
            {
                var newInternalNodeString = tools.getInternalNodeString(updatedInternalNodesArr[i]);
                JsonArr.push({
                    "value": newInternalNodeString,
                    "key": tools.hash(newInternalNodeString)
                }); 
            }
        }

        //Generate the tree string
        var treeString = "default/1/" + tools.hash(internalNode);

        //The logical index of where the new child will go
        var childIndex = parentNode["children"].length;

        //If this is a new root node
        if (newRoot)
        {
            childIndex = 0;
            //We only count the other root nodes (the parent node may have other children)
            for (let i = 0; i < parentNode["children"].length; i++) 
            {
                var tempChildNode = tools.findInTree(this.currentTreeModel, ["data", "id"], parentNode["children"][i]["data"]["id"]);
                if (tempChildNode["data"]["roleInParent"] == "rootNodes")
                {
                    childIndex++;
                }
            }
        }

        //We're going to perform an add and set property operation and move all the siblings + the node itself
        var numberOfOperations = 3 + parentNode["children"].length;

        //Add new child operation
        var operationString = "AddNewChildOp;" + parentId + ";" + role + ";" + childIndex + ";" + childId + ";" + encodeURIComponent(concept) + ',';

        //Nothing has to be moved if it's a new root node
        if (!newRoot)
        {
            //The siblings have to "move" (we let them keep their original index)
            for (let i = 0; i < parentNode["children"].length; i++) 
            {
                var curSibling = parentNode["children"][i];
                operationString += "MoveNodeOp;" + curSibling["data"]["id"] + ";" + parentId + ";" + curSibling["data"]["roleInParent"] + ";" + i + ',';
            }      
            //And the new node has to "move" as well for some reason (we place it at the end of the child array)
            operationString += "MoveNodeOp;" + childId + ";" + parentId + ";" + role + ";" + childIndex + ',';
        }
        else
        {
            numberOfOperations = 2;
        }
 
        //Set the MPS node Id of the new child
        operationString += "SetPropertyOp;" + childId + ";%23mpsNodeId%23;" + this.highestMpsID;

        //Update the CPVersion for our operation
        this.highestID = tools.upVersion(this.highestID);
        var CPVersionId = _.cloneDeep(this.highestID);
        this.log("New highest ID: " + this.highestID);

        this.CPVersion = 
        {
            "id": CPVersionId,
            "timestamp": tools.getTime(),
            "author": "null",
            "treeHash": tools.hash(treeString),
            "numberOfOperations": numberOfOperations,
            "ops": operationString,
            "key": baseVersion
        }

        //If this was a Spoofax insert
        if (fromParsafix)
        {
            this.parsafixOps.push(this.CPVersion["id"] + '_' + this.CPVersion["treeHash"]);

            //Update Parsafix's MPS data model
            this.classEmitter.emit('mpsNodeUpdate', {
                "spoofax_line_index":spoofaxLineIndex,
                "opType":"AddNewChildOp",
                "mps_node":{
                    "leafHash":tools.hash(newChildLeaf),
                    "nodeHash":tools.hash(newChildNodeString),
                    "id":childId,
                    "concept":concept,
                    "parentId":parentId,
                    "roleInParent":role,
                    "properties":["%23mpsNodeId%23=" + this.highestMpsID],
                },
                "modelId":modelId
            });
        }

        //Construct the CPVersion string
        var CPVersionString = CPVersionId + "/" + this.CPVersion["timestamp"] + "/null/" + this.CPVersion["treeHash"] + "/" + this.CPVersion["key"] + "///" + this.CPVersion["numberOfOperations"] + "/" + this.CPVersion["ops"];

        //Construct the JSON
        JsonArr.push({
                "value": parentNodeString,
                "key": tools.hash(parentNodeString)
            });
        JsonArr.push({
                "value": updatedParentLeaf,
                "key": tools.hash(updatedParentLeaf)
            });
        JsonArr.push({
                "value": newChildNodeString,
                "key": tools.hash(newChildNodeString)
            });
        JsonArr.push({
                "value": newChildLeaf,
                "key": tools.hash(newChildLeaf)
            });
        JsonArr.push({
                "value": internalNode,
                "key": tools.hash(internalNode)
            });
        JsonArr.push({
                "value": treeString,
                "key": tools.hash(treeString)
            });
        JsonArr.push({
                "value": CPVersionString,
                "key": tools.hash(CPVersionString)
            });
        JsonArr.push({
                "value": tools.hash(CPVersionString),
                "key": 'branch_default_master'
            });

        var value = JSON.stringify(JsonArr);

        var httpString = 'PUT /putAll HTTP/1.1\r\n' +
        'Host: localhost:28101\r\n' +
        'Connection: keep-alive\r\n' +
        'Authorization: Bearer null\r\n' +
        'User-Agent: Jersey/2.31 (HttpUrlConnection 11.0.6)\r\n' + 
        'Accept: text/plain\r\n' + 
        'Content-Type: text/plain\r\n' +
        'Content-Length: ' + value.length + '\r\n' +
        '\r\n' + value + '\r\n';

        this.log('\nSending:\n' + httpString);
        console.log('\nSending:\n' + httpString);
        console.log("Current internal node: " + JSON.stringify(this.hamt));

        fs.appendFile('myTraffic.txt', '\n' + httpString + '\n', function (err) 
        {
            if (err)
            {
                console.log("File write error: " + err);
            }            
        });

        this.client.write(httpString);

        callback(childId);
    }

    //-------------------------------------------------------------------------------
    // Delete a node
    //-------------------------------------------------------------------------------
    deleteNode(childId, fromParsafix, deletingChildren)
    {
        var childDeletions = [];

        //Get the child node
        var childNode = tools.findInTree(this.currentTreeModel, ["data", "id"], childId);

        //Find out if the child we want to delete has children itself
        for (let i = 0; i < childNode["children"].length; i++) 
        {
            //Those children have to be deleted as well. Remove them from the HAMT and get their node IDs
            childDeletions = childDeletions.concat(this.deleteNode(childNode["children"][i]["data"]["id"], true, true));
        }

        //Get the parent node
        var parentNode = tools.findInTree(this.currentTreeModel, ["data", "id"], childNode["data"]["parentId"]);

        //Get the children as a string
        var childrenString = this.getChildrenString(parentNode);
        //Remove the child we're deleting
        childrenString = childrenString.replace("," + childId, "").replace(childId + ",", "").replace(childId, "");

        var parentNodeString = parentNode["data"]["id"] + "/" + encodeURIComponent(parentNode["data"]["concept"]) + "/" + parentNode["data"]["parentId"] + "/" + parentNode["data"]["roleInParent"] + "/" + childrenString + "/" + this.getPropertiesString(parentNode) + "/" + this.getReferencesString(parentNode);
        var updatedParentLeaf = "L/" + parentNode["data"]["id"] + "/" + tools.hash(parentNodeString);

        //Get the root node
        var rootNode = this.constructNodeString(this.currentTreeModel, "1");
        var rootNodeLeaf = "L/1/" + tools.hash(rootNode);

        //Create an empty array for all the internal nodes in the  that may change due to this operation
        var updatedInternalNodesArr = [];
        //Get the internal node
        tools.put(childId, 0, this.hamt, null, updatedInternalNodesArr);
        tools.updateInternalNode(this.hamt, parentNode["leafHash"], tools.hash(updatedParentLeaf), updatedInternalNodesArr);

        //If we're not just deleting this child because its parent was deleted
        if (!deletingChildren)
        {
            var internalNode = tools.getInternalNodeString(this.hamt);

            //If internal nodes have been updated
            for (let i = 0; i < updatedInternalNodesArr.length; i++) 
            {
                console.log("Updating internal node: " + JSON.stringify(updatedInternalNodesArr[i]));
                console.log(JSON.stringify(updatedInternalNodesArr));

                //We need to tell Modelix about it
                var updatedInternalNodeString = tools.getInternalNodeString(updatedInternalNodesArr[i]);
                JsonArr.push({
                    "value": updatedInternalNodeString,
                    "key": tools.hash(updatedInternalNodeString)
                }); 
            }

            //Generate the tree string
            var treeString = "default/1/" + tools.hash(internalNode);

            //We're going to perform an mode and delete node operation
            var numberOfOperations = 2 + childDeletions.length;

            //Get the node index
            var nodeIndex = 0;
            if (childNode["data"].hasOwnProperty("index"))
            {
                nodeIndex = childNode["data"]["index"];
            }
            else
            {
                nodeIndex = parentNode["data"]["childrenIds"].indexOf(childId);
            }

            //Detach the node
            var operationString = "MoveNodeOp;" + childId + ";1;detached;" + nodeIndex + ',';

            //Delete the children of the child
            for (let i = 0; i < childDeletions.length; i++) 
            {
                operationString += "DeleteNodeOp;" + childDeletions[i] + ',';
            }

            //Delete the child node
            operationString += "DeleteNodeOp;" + childId;

            //Update the CPVersion for our operation
            this.highestID = tools.upVersion(this.highestID);
            var CPVersionId = _.cloneDeep(this.highestID);
            this.log("New highest ID: " + this.highestID);
            var baseVersion = this.CPVersion["key"];
            this.CPVersion = 
            {
                "id": CPVersionId,
                "timestamp": tools.getTime(),
                "author": "null",
                "treeHash": tools.hash(treeString),
                "numberOfOperations": numberOfOperations,
                "ops": operationString,
                "key": baseVersion//childNode["baseVersion"] //base version of child
            }

            //If this operation came from Parsafix
            if (fromParsafix)
            {
                //We save the CPVersion so we don't send the change back
                this.parsafixOps.push(this.CPVersion["id"] + '_' + this.CPVersion["treeHash"]);

                this.classEmitter.emit('mpsNodeUpdate', 
                {
                    "opType":"DeleteNodeOp",
                    "mps_node":{
                        "id":childId,
                        "parentId":childNode["data"]["parentId"]
                    }
                });
            }

            //Construct the CPVersions tring
            var CPVersionString = CPVersionId + "/" + this.CPVersion["timestamp"] + "/null/" + this.CPVersion["treeHash"] + "/" + this.CPVersion["key"] + "///" + this.CPVersion["numberOfOperations"] + "/" + this.CPVersion["ops"];

            //Construct the JSON
            var JsonArr = [
                {
                    "value": parentNodeString,
                    "key": tools.hash(parentNodeString)
                },
                {
                    "value": updatedParentLeaf,
                    "key": tools.hash(updatedParentLeaf)
                },
                {
                    "value": rootNode,
                    "key": tools.hash(rootNode)
                },
                {
                    "value": rootNodeLeaf,
                    "key": tools.hash(rootNodeLeaf)
                },
                {
                    "value": internalNode,
                    "key": tools.hash(internalNode)
                },
                {
                    "value": treeString,
                    "key": tools.hash(treeString)
                },
                {
                    "value": CPVersionString,
                    "key": tools.hash(CPVersionString)
                },
                {
                    "value": tools.hash(CPVersionString),
                    "key": 'branch_default_master'
                }
            ];

            var value = JSON.stringify(JsonArr);

            var httpString = 'PUT /putAll HTTP/1.1\r\n' +
            'Host: localhost:28101\r\n' +
            'Connection: keep-alive\r\n' +
            'Authorization: Bearer null\r\n' +
            'User-Agent: Jersey/2.31 (HttpUrlConnection 11.0.6)\r\n' + 
            'Accept: text/plain\r\n' + 
            'Content-Type: text/plain\r\n' +
            'Content-Length: ' + value.length + '\r\n' +
            '\r\n' + value + '\r\n';

            console.log('\nSending:\n' + httpString);

            fs.appendFile('myTraffic.txt', '\n' + httpString + '\n', function (err) 
            {
                if (err)
                {
                    console.log("File write error: " + err);
                }            
            });

            this.client.write(httpString);
        }
        //If we're deleting this child because its parent was deleted
        else 
        {
            childDeletions.push(childId);
            return childDeletions;
        }
    }

    //-------------------------------------------------------------------------------
    // Set a property of a node
    //-------------------------------------------------------------------------------
    setNodeProperty(nodeId, propToReplace, newPropVal, fromParsafix)
    {
        //Sometimes we accidentally send a new node its pending property twice, probably due to lag on the Modelix side
        if (this.pendingNewNodeProperties.hasOwnProperty(nodeId))
        {
            //We want to prevent this from happening, so we give it a flag to check if we've already assigned it the property
            if (this.pendingNewNodeProperties[nodeId]["propertyAssigned"] == true)
            {
                return;
            }
            else
            {
                this.pendingNewNodeProperties[nodeId]["propertyAssigned"] = true;
            }
        }

        var JsonArr = [];

        //Get the node that we want to change
        var node = tools.findInTree(this.currentTreeModel, ["data", "id"], nodeId);

        //If the node exists
        if (node != null)
        {
            //Construct the new version of the node
            var nodeString = this.constructNodeString(this.currentTreeModel, nodeId, propToReplace, newPropVal);
            var newNodeHash = tools.hash(nodeString);
            var newLeaf = "L/" + nodeId + "/" + newNodeHash;

            //Create an empty array for all the internal nodes in the HAMT that may change due to this operation
            var updatedInternalNodesArr = [];
            //Update the internal node of the project
            tools.updateInternalNode(this.hamt, node["leafHash"], tools.hash(newLeaf), updatedInternalNodesArr);
            var internalNode = tools.getInternalNodeString(this.hamt);

            //If internal nodes have been updated
            for (let i = 0; i < updatedInternalNodesArr.length; i++) 
            {
                console.log("Updating internal node: " + JSON.stringify(updatedInternalNodesArr[i]));
                console.log(JSON.stringify(updatedInternalNodesArr));

                //We need to tell Modelix about it
                var updatedInternalNodeString = tools.getInternalNodeString(updatedInternalNodesArr[i]);
                JsonArr.push({
                    "value": updatedInternalNodeString,
                    "key": tools.hash(updatedInternalNodeString)
                }); 
            }

            //Generate the tree string
            var treeString = "default/1/" + tools.hash(internalNode);

            //Get the current timestamp
            var timestamp = tools.getTime();

            var baseVersion = this.CPVersion["key"];
            //Get the operation's base version (hash of previous operation for this node)
            if (node.hasOwnProperty("baseVersion"))
            {
                baseVersion = node["baseVersion"];
            }

            //Construct the operation string
            var CPVersion = tools.upVersion(this.CPVersion["id"]) + "/" + timestamp + "/null/" + tools.hash(treeString) + "/" + baseVersion + "///1/SetPropertyOp;" + nodeId + ";" + propToReplace + ";" + newPropVal;

            //If this operation came from Parsafix
            if (fromParsafix)
            {
                //We save the CPVersion so we don't send the change back to Parsafix
                this.parsafixOps.push(tools.upVersion(this.CPVersion["id"]) + '_' + tools.hash(treeString));

                //Update Parsafix's MPS data model
                var propArr = this.getPropertiesString(node, propToReplace, newPropVal).split(',');
                this.classEmitter.emit('mpsNodeUpdate', {
                    "opType":"SetPropertyOp",
                    "mps_node":{
                        "leafHash":tools.hash(newLeaf),
                        "nodeHash":tools.hash(nodeString),
                        "id":nodeId,
                        "properties":propArr,
                    }
                });

                console.log("Sending update: " + JSON.stringify(propArr));
            }

            //Construct the JSON
            JsonArr.push({
                "value": nodeString,
                "key": tools.hash(nodeString)
            });
            JsonArr.push({
                "value": newLeaf,
                "key": tools.hash(newLeaf)
            });
            JsonArr.push({
                "value": internalNode,
                "key": tools.hash(internalNode)
            });
            JsonArr.push({
                "value": treeString,
                "key": tools.hash(treeString)
            });
            JsonArr.push({
                "value": CPVersion,
                "key": tools.hash(CPVersion)
            });
            JsonArr.push({
                "value": tools.hash(CPVersion),
                "key": "branch_default_master"
            });

            var value = JSON.stringify(JsonArr);

            var httpString = 'PUT /putAll HTTP/1.1\r\n' +
            'Host: localhost:28101\r\n' +
            'Connection: keep-alive\r\n' +
            'Authorization: Bearer null\r\n' +
            'User-Agent: Jersey/2.31 (HttpUrlConnection 11.0.6)\r\n' + 
            'Accept: text/plain\r\n' + 
            'Content-Type: text/plain\r\n' +
            'Content-Length: ' + value.length + '\r\n' +
            '\r\n' + value + '\r\n';

            console.log('\nSending:\n' + httpString);

            this.client.write(httpString);
        }
        else
        {
            console.log("Node '" + nodeId + "' does not exist in the current tree model.")
        }
    }

    //-------------------------------------------------------------------------------
    // Returns a string containing the given node's properties
    //-------------------------------------------------------------------------------
    getPropertiesString(node, propToReplace, newPropVal)
    {
        var properties = "";
        for (let i = 0; i < node["data"]["properties"].length; i++) 
        {
            var propKey = node["data"]["properties"][i].split('=')[0];

            //If this is the property we want to replace
            if (propToReplace != null && propKey == propToReplace)
            {
                //Replace it
                properties += propKey + '=' + newPropVal;
            }
            else
            {
                properties += node["data"]["properties"][i];
            }

            if (i != node["data"]["properties"].length - 1)
            {
                properties += ",";
            }
        }

        return properties;
    }

    //-------------------------------------------------------------------------------
    // Returns a string containing the given node's children
    //-------------------------------------------------------------------------------
    getChildrenString(node)
    {
        var children = "";
        for (let i = 0; i < node["data"]["childrenIds"].length; i++) 
        {
            children += node["data"]["childrenIds"][i];

            if (i != node["data"]["childrenIds"].length - 1 && node["data"]["childrenIds"][i].length > 0)
            {
                children += ",";
            }
        }

        return children;
    }

    //-------------------------------------------------------------------------------
    // Returns a string containing the given node's references
    //-------------------------------------------------------------------------------
    getReferencesString(node)
    {
        var references = "";
        for (let i = 0; i < node["data"]["references"].length; i++) 
        {
            references += node["data"]["references"][i];

            if (i != node["data"]["references"].length - 1)
            {
                references += ",";
            }
        }

        return references;
    }

    //-------------------------------------------------------------------------------
    // Returns a string comprised of the contents of an existing node (with replaced property)
    //-------------------------------------------------------------------------------
    constructNodeString(tree, nodeId, propToReplace, newPropVal)
    {
        //Find the node in the tree
        var node = tools.findInTree(tree, ["data", "id"], nodeId);

        //Stringify its children
        var children = this.getChildrenString(node);

        //Stringify its properties (replace the old property value with the new one)
        var properties = this.getPropertiesString(node, propToReplace, newPropVal);

        //If the property did not exist yet
        if (propToReplace != null && properties.indexOf(propToReplace + '=') == -1)
        {
            //We add it now
            properties += ',' + propToReplace + '=' + newPropVal;
        }

        //Stringify its references
        var references = this.getReferencesString(node);

        //Construct the new version of the node
        var nodeString = nodeId + "/" + 
        encodeURIComponent(node["data"]["concept"]) + "/" + 
        node["data"]["parentId"] + "/" + 
        encodeURIComponent(node["data"]["roleInParent"]) + "/" + 
        children + "/" + 
        properties + "/" + 
        references;

        return nodeString;
    }

    //-------------------------------------------------------------------------------
    // Returns an array of leafHashes of the nodes in the given tree
    //-------------------------------------------------------------------------------
    getNodes(tree)
    {
        var nodeList = [];

        for (let i = 0; i < tree["children"].length; i++) 
        {
            nodeList = nodeList.concat(this.getLeafHashes(tree["children"][i], []));
        }

        return nodeList;
    }

    //-------------------------------------------------------------------------------
    // Returns an array with the given node's leaf hash and the leaf hashes of its children
    //-------------------------------------------------------------------------------
    getLeafHashes(node, leafHashArr)
    {
        leafHashArr.push(node["leafHash"]);

        for (let i = 0; i < node["children"].length; i++) 
        {
            this.getLeafHashes(node["children"][i], leafHashArr);
        }

        return leafHashArr;
    }

    //-------------------------------------------------------------------------------
    // Returns the MPS role string belonging to the given DSL concept
    //-------------------------------------------------------------------------------
    getRoleString(concept)
    {
        switch (concept) {
            case "root":
                return "rootNodes";
            case "parent":
                return "content";
            case "child":
                return "children";
            default:
                return '';
        }
    }

    //-------------------------------------------------------------------------------
    // Returns the MPS concept string belonging to the given DSL concept
    //-------------------------------------------------------------------------------
    getConceptString(concept)
    {
        switch (concept) {
            case "root":
                return "c:7a5361d8-8b2b-4f3a-a89a-5c606c9b345b/6341735222733465635:GenericDSL.structure.Root";
            case "parent":
                return "c:7a5361d8-8b2b-4f3a-a89a-5c606c9b345b/6341735222733465632:GenericDSL.structure.Parent";
            case "child":
                return "c:7a5361d8-8b2b-4f3a-a89a-5c606c9b345b/6341735222733465641:GenericDSL.structure.Child";
            default:
                return '';
        }
    }

    //-------------------------------------------------------------------------------
    // Returns the hex string of a decimal number
    //-------------------------------------------------------------------------------
    hex(decimal)
    {
        return decimal.toString(16);
    }

    //-------------------------------------------------------------------------------
    // Returns the decimal number of a hex string
    //-------------------------------------------------------------------------------
    dec(hex)
    {
        return parseInt(hex.toString(), 16);
    }

    log(message)
    {
        if (this.debug) 
        {
            console.log(message);
        }

        //Add the message to today's log file
        var today = new Date();
        var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        var time = today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();

        var fileName = "mps_" + date + ".log";

        fs.appendFile('logs/' + fileName, '\n--' + time + '--\t' + message + '\n', function (err) 
        {
            if (err)
            {
                console.log("Log write error: " + err);
            }            
        });
    }
}

//-------------------------------------------------------------------------------
// Make the class available
//-------------------------------------------------------------------------------
module.exports = {
    ModelixClient
}