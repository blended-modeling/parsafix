const tools = require('./tools');
const _ = require('lodash');

//Regex, element type name, can have children, array of possible children regex indices
const spoofaxElementRegex = {
    "dsl":[
        { "regex": /([^\n]*\ )?(?:root)\ [^\ \{\}]+/, "type": "root" },
        { "regex": /([^\n]*\ )?(?:parent)\ [^\ \{\}]+/, "type": "parent" },
        { "regex": /([^\n]*\ )?(?:child)\ [^\ \{\}]+/, "type": "child" },
    ]
};

//-------------------------------------------------------------------------------
// The Parsafix parser class
//-------------------------------------------------------------------------------
class Parser
{
    parsafixDataModel;
    classEmitter;

    mpsDataModel = {};
    spoofaxDataModel = {};

    constructor(emitter)
    {
        this.parsafixDataModel = {};
        this.classEmitter = emitter;
    }

    //-------------------------------------------------------------------------------
    // Translates MPS project data to Parsafix data
    //-------------------------------------------------------------------------------
    mpsToParsafix(treeModel)
    {
        //MPS has a general tree structure setup from the very beginning.
        //Even before there is any real model data in it
        //We don't really need that initial tree at first

        this.mpsDataModel = treeModel;
    }

    //-------------------------------------------------------------------------------
    // Translates an MPS edit operation to a change in the project data
    //-------------------------------------------------------------------------------
    mpsOperation(opType, nodeId, treeModel, op)
    {
        console.log("MPS operation:", opType, nodeId, op);

        switch (opType)
        {   
            case 'AddNewChildOp':
            case 'DeleteNodeOp':
                this.handleMpsAddSetDeleteNodeOp(nodeId, treeModel, opType);
                break;
            case 'SetPropertyOp':
                //We're only dealing with name changes for now
                if (unescape(op.split(';')[2]) == "name")
                {
                    this.handleMpsAddSetDeleteNodeOp(nodeId, treeModel, opType);
                }
                else
                {
                    console.log("Non-name property change: " + op.split(';')[2]);
                }
                break;
            case 'MoveNodeOp':
                break;
            case 'NoOp':
                break;
            case 'SetReferenceOp':
                break;
            case 'UndoOp':
                break;

            default:
                console.log("\nUnknown operation: " + opType);
        }

        //Emit the new Parsafix data
        this.classEmitter.emit('parsafix', _.cloneDeep(this.parsafixDataModel));
    }

    //-------------------------------------------------------------------------------
    // Handle MPS add child operation
    //-------------------------------------------------------------------------------
    handleMpsAddSetDeleteNodeOp(nodeId, treeModel, opType)
    {
        //If we're deleting a node
        if (opType == 'DeleteNodeOp')
        {
            //Use the old tree model to find it
            treeModel = _.cloneDeep(this.mpsDataModel);
        }

        var node = tools.findInTree(treeModel, ["data", "id"], nodeId);

        //Get the node's type
        var type = "dsl";

        //And its root node concept key (hardcoded for now)
        var rootNodeConceptKey = 'GenericDSL.structure.Root';

        //Look for the node's root node (maybe this is a new root node)
        var rootNode = node;
        while (rootNode != null && rootNode["data"]["id"] != "1")
        {
            if (rootNode["data"]["concept"].endsWith(rootNodeConceptKey))
            {
                break;
            }

            rootNode = tools.findInTree(treeModel, ["data", "id"], rootNode["data"]["parentId"]);
        }

        //If we've found the root node
        if (rootNode != null)
        {
            var curModelId = null;
            var curModel = null;

            //Find the corresponding model
            for (const modelId in this.parsafixDataModel) 
            {
                if (this.parsafixDataModel[modelId].hasOwnProperty("mps_root_id") && this.parsafixDataModel[modelId]["mps_root_id"] == rootNode["data"]["id"])
                {
                    curModelId = modelId;
                    curModel = this.parsafixDataModel[modelId];
                }
            }

            //If this model does not exist yet
            if (curModel == null)
            {
                //That shouldn't be the case if we're deleting a node
                if (opType == 'DeleteNodeOp')
                {
                    console.log("Error: model of to-delete node '" + node["data"]["id"] + "' doesn't exist.");
                    return;
                }

                //Create it and add it to the project mapping
                curModelId = "model_" + Object.keys(this.parsafixDataModel).length;
                curModel = {
                    "mps_root_id":rootNode["data"]["id"],
                    "spoofax_file":curModelId + '.dsl',
                    "type":type,
                    "children":[]
                };
                this.parsafixDataModel[curModelId] = curModel;
            }
            else
            {
                //If we're adding a node
                if (opType == 'AddNewChildOp')
                {
                    //Make sure it doesn't already exist
                    var newNode = tools.findInTree(this.parsafixDataModel[curModelId], ["mps_id"], nodeId);
                    if (newNode != null)
                    {
                        console.log("Error: Node already exists (cannot add it again}: " + nodeId);
                        return;
                    }
                }
            }

            //If we're deleting the node
            if (opType == 'DeleteNodeOp')
            {
                //Do that
                var mappedElement = tools.findInTree(curModel, ["mps_id"], node["data"]["id"]);

                //If this is a root node
                if (mappedElement["parent_mps_id"] == null)
                {
                    //Remove the model
                    for (const key in this.parsafixDataModel) 
                    {
                        if (this.parsafixDataModel[key]["mps_root_id"] == mappedElement["mps_id"])
                        {
                            delete this.parsafixDataModel[key];
                            this.mpsDataModel = _.cloneDeep(treeModel);

                            //Propogate the change to Spoofax
                            this.parsafixToSpoofaxEdit(mappedElement, curModel, opType, true, curModelId);

                            return;
                        }
                    }
                }

                //Find the parent and delete the child
                var parentElement = tools.findInTree(curModel, ["mps_id"], mappedElement["parent_mps_id"]);
                parentElement["children"].splice(parentElement["children"].indexOf(mappedElement), 1);
                this.mpsDataModel = _.cloneDeep(treeModel);

                //Propogate the change to Spoofax
                this.parsafixToSpoofaxEdit(mappedElement, curModel, opType, false, curModelId);

                return;
            }

            //Map the element
            this.mapMpsDslElement(node, curModel, opType, curModelId);


            //Save the new tree model
            this.mpsDataModel = _.cloneDeep(treeModel);
        }
        else
        {
            console.log("Error: MPS " + type.toUpperCase() + " node '" + nodeId + "' does not have a root node.");
        }
    }

    //-------------------------------------------------------------------------------
    // Maps an MPS DSL element (this function is only reached for 'addNewChildOp' and 'setPropertyOp')
    //-------------------------------------------------------------------------------
    mapMpsDslElement(node, curModel, opType, curModelId)
    {
        //Get the element type from the node concept
        var conceptArr = node["data"]["concept"].split('.');
        var type = conceptArr[conceptArr.length - 1].toLowerCase();
        var isRootNode = false;

        switch (type)
        {
            //If this is a root element
            case "root":
                if (!curModel.hasOwnProperty("children"))
                {
                    curModel["children"] = [];
                }

                this.editMappedElement(curModel["children"], "mps_id", node["data"]["id"], 
                { 
                    "name":this.getMpsName(node), 
                    "type":type, 
                    "parent_mps_id":null
                }, "dsl", true);

                isRootNode = true;
                break;
            //If this is a parent element
            case "parent":
                var parentRootElement = tools.findInTree(curModel, ["mps_id"], node["data"]["parentId"]);

                if (parentRootElement != null)
                {
                    this.editMappedElement(parentRootElement["children"], "mps_id", node["data"]["id"], 
                    { 
                        "name":this.getMpsName(node), 
                        "type":type, 
                        "parent_mps_id":parentRootElement["mps_id"]
                    }, "dsl", true, parentRootElement);
                }
                break;
            case "child":
                var parentParentElement = tools.findInTree(curModel, ["mps_id"], node["data"]["parentId"]);

                if (parentParentElement != null)
                {
                    this.editMappedElement(parentParentElement["children"], "mps_id", node["data"]["id"], 
                    { 
                        "name":this.getMpsName(node), 
                        "type":type, 
                        "parent_mps_id":parentParentElement["mps_id"] 
                    }, "dsl", false, parentParentElement);
                }
                break;
        
            default:
                break;
        }

        var mappedElement = tools.findInTree(curModel, ["mps_id"], node["data"]["id"]);

        console.log("Current model: " + JSON.stringify(curModel));

        //If this is a new node
        if (opType == 'AddNewChildOp')
        {
            //Give it a Spoofax line index
            mappedElement["spoofax_line_index"] = tools.getSpoofaxNewLineIndex(this.spoofaxDataModel, this.parsafixDataModel[curModelId]["spoofax_file"]);
        }

        //Propogate the change to Spoofax
        this.parsafixToSpoofaxEdit(mappedElement, curModel, opType, isRootNode, curModelId);
    }

    //-------------------------------------------------------------------------------
    // Propogates a Parsafix data edit to Spoofax
    //-------------------------------------------------------------------------------
    parsafixToSpoofaxEdit(editedElement, model, opType, isRootNode, modelId)
    {
        var editData = {
            "opType": opType,
            "fileName": this.parsafixDataModel[modelId]["spoofax_file"]
        };

        switch (opType)
        {   
            case 'AddNewChildOp':
                var text = tools.generateSpoofaxDslLine(editedElement, true);

                //Tell it what text to add
                editData["text"] = text;

                //If we've added a new file/model
                if (isRootNode)
                {
                    //Tell Spoofax we need a new file
                    editData["isRootNode"] = true;

                    //Update the Spoofax project model
                    this.spoofaxDataModel[this.parsafixDataModel[modelId]["spoofax_file"]] = text;
                }
                else
                {
                    //Tell Spoofax we don't need a new file
                    editData["isRootNode"] = false;

                    //Tell it on what line the new node should appear
                    var newChildLineIndex = tools.getSpoofaxNewLineIndex(this.spoofaxDataModel, this.parsafixDataModel[modelId]["spoofax_file"]);
                    editData["lineIndex"] = newChildLineIndex;

                    //Update the Spoofax project model
                    this.spoofaxDataModel[this.parsafixDataModel[modelId]["spoofax_file"]] = tools.putSpoofaxLine(this.spoofaxDataModel, this.parsafixDataModel[modelId]["spoofax_file"], newChildLineIndex, text);
                }

                break;
            case 'SetPropertyOp':
                var difData = tools.getMpsEditOffset(editedElement, _.cloneDeep(this.mpsDataModel), this.spoofaxDataModel, this.parsafixDataModel[modelId]["spoofax_file"]);

                if (difData != null)
                {
                    //Tell Sppofax on what line the change has taken place
                    editData["lineIndex"] = editedElement["spoofax_line_index"];

                    //Tell it the change offset
                    editData["difIndex"] = difData["difIndex"];

                    //Tell it the length of the change
                    editData["difLength"] = difData["difLength"];

                    //Tell it the edit
                    editData["edit"] = difData["edit"];

                    //Tell it the new line
                    var text = tools.generateSpoofaxDslLine(editedElement, false, tools.getSpoofaxLine(this.spoofaxDataModel, this.parsafixDataModel[modelId]["spoofax_file"], editedElement["spoofax_line_index"]));
                    editData["text"] = text;

                    //Update the Spoofax project model
                    this.spoofaxDataModel[this.parsafixDataModel[modelId]["spoofax_file"]] = tools.putSpoofaxLine(this.spoofaxDataModel, this.parsafixDataModel[modelId]["spoofax_file"], editedElement["spoofax_line_index"], text);   
                }             
                break;
            case 'DeleteNodeOp':
                //If we've deleted a file/model
                if (isRootNode)
                {

                }
                break;
            default:
                break;
        }
        
        if (Object.keys(editData).length > 1)
        {
            //Emit the new Spoofax edit
            console.log("Emitting: ", this.spoofaxDataModel);
            this.classEmitter.emit('spoofax', editData, _.cloneDeep(this.spoofaxDataModel));
        }
    }

    //-------------------------------------------------------------------------------
    // Generate DSL mapping from an MPS project node
    //-------------------------------------------------------------------------------
    dslFromMps(rootElementNode, treeModel)
    {
        var rootElementName = this.getMpsName(rootElementNode);

        var rootElementMap = {};

        //Save the DSL rootElement name
        rootElementMap["name"] = rootElementName;
        rootElementMap["mps_id"] = rootElementNode["id"];
        rootElementMap["type"] = "root";
        rootElementMap["children"] = [];

        //Get the parent elements in the DSL root element
        for (let i = 0; i < rootElementNode["data"]["childrenIds"].length; i++) 
        {
            var parentElementNode = tools.findInTree(treeModel, ["data", "id"], rootElementNode["data"]["childrenIds"][i]);

            if (parentElementNode != null)
            {
                var parentElementName = this.getMpsName(parentElementNode);

                var parentElementMap = 
                {
                    "name": parentElementName,
                    "mps_id": parentElementNode["data"]["id"],
                    "type": "parent",
                    "children": []
                }

                //Get the child elements in the DSL parent element
                for (let j = 0; j < parentElementNode["data"]["childrenIds"].length; j++) 
                {
                    var childElementNode = tools.findInTree(treeModel, ["data", "id"], parentElementNode["data"]["childrenIds"][j]);

                    if (childElementNode != null)
                    {
                        var childElementName = this.getMpsName(childElementNode);

                        var childElementMap = 
                        {
                            "name": childElementName,
                            "mps_id": childElementNode["data"]["id"],
                            "type": "child"
                        }

                        parentElementMap["children"].push(childElementMap);
                    }
                }

                rootElementMap["children"].push(parentElementMap);
            }
        }

        if (!this.parsafixDataModel.hasOwnProperty(rootElementNode["parentId"]))
        {
            this.parsafixDataModel[rootElementNode["parentId"]] = { "children": [] };
        }
        this.parsafixDataModel[rootElementNode["parentId"]]["children"].push(rootElementMap);
    }   

    //-------------------------------------------------------------------------------
    // Returns the concept of an MPS node
    //-------------------------------------------------------------------------------
    getMpsConcept(node)
    {
        try 
        {
            var conceptArr = node["data"]["concept"].split(':');
            var concept = conceptArr[conceptArr.length - 1];
            return concept;
        } 
        catch (error) 
        {
            console.log("Could not get concept: 'invalid MPS node'");
        }
    }

    //-------------------------------------------------------------------------------
    // Returns the name of an MPS node
    //-------------------------------------------------------------------------------
    getMpsName(node)
    {
        try 
        {
            var name = null;

            node["data"]["properties"].forEach(prop => {
               var keyVal = prop.split('=');
               if (keyVal[0] == "name")
               {
                  name = keyVal[1]; 
                  name = name.replaceAll('\u0000', '');

                  return name;
               }
            });

            return name;
        } 
        catch (error) 
        {
            console.log("Could not get name of MPS node: " + JSON.stringify(node));
        }
    }

    //-------------------------------------------------------------------------------
    // Returns the role of an MPS node
    //-------------------------------------------------------------------------------
    getRole(node)
    {
        if (node["data"].hasOwnProperty("roleInParent"))
        {
            return node["data"]["roleInParent"]
        }
        else
        {
            return null;
        }
    }

    //-------------------------------------------------------------------------------
    // Translates Spoofax project data to Parsafix data
    //-------------------------------------------------------------------------------
    spoofaxToParsafix(spoofaxProject, opType, op, dir)
    {
        console.log("Old: " + JSON.stringify(this.spoofaxDataModel));
        console.log("New: " + JSON.stringify(spoofaxProject));

        //Because it's real-time, we're assuming that everything stays in more or less the same place
        //If anything moves, we'll treat it as a new element
        //So the Saros ID can be the vertical line position

        //If this isn't a duplicate update
        if (this.spoofaxDataModel != spoofaxProject)
        {
            this.spoofaxDataModel = spoofaxProject;

            switch (opType) {
                case 'insertOp':
                case 'deleteOp':
                    this.handleSpoofaxInsertDeleteOp(spoofaxProject, opType, op, dir);
                    break;

                case 'initialization':
                case 'noOp':
                    break;

                default:
                    console.log("The operation type '" + opType + "' is currently not supported.");
                    break;
            }
            
            //Emit the new Parsafix data
            this.classEmitter.emit('parsafix', _.cloneDeep(this.parsafixDataModel));
        }
    }

    //-------------------------------------------------------------------------------
    // Handles a Spoofax insertion and deletion operation
    //-------------------------------------------------------------------------------
    handleSpoofaxInsertDeleteOp(spoofaxProject, opType, op, dir)
    {
        var opDetails = op["$"];
        var lineIndex = parseInt(opDetails["sl"]);
        var offset = parseInt(opDetails["so"]);

        var curModelId = null;
        var curModel = null;

        //Find the corresponding model
        for (const modelId in this.parsafixDataModel) 
        {
            if (this.parsafixDataModel[modelId].hasOwnProperty("spoofax_file") && this.parsafixDataModel[modelId]["spoofax_file"] == dir)
            {
                curModelId = modelId;
                curModel = this.parsafixDataModel[modelId];
            }
        }

        //If this model does not exist yet
        if (curModel == null)
        {
            //Create it and add it to the project mapping
            curModelId = "model_" + Object.keys(this.parsafixDataModel).length;
            curModel = {
                "spoofax_file":dir,
                "type":"dsl",//hardcoded for now
                "children":[]
            };
            this.parsafixDataModel[curModelId] = curModel;
        }

        this.mapLine(curModel, spoofaxProject[dir], lineIndex, opType, curModelId);
    }

    //-------------------------------------------------------------------------------
    // Maps single Spoofax line to a corresponding element if possible
    //-------------------------------------------------------------------------------
    mapLine(curModel, text, lineIndex, opType, modelId)
    {
        var type = curModel["type"];

        var lineArr = text.split('%0A');

        var line = tools.sarosToRegularText(lineArr[lineIndex]).trim();
        var mapped = false;

        //Loop through the Spoofax element regular expressions
        for (const regexType in spoofaxElementRegex) 
        {
            //If we already know this is the model's type, or we don't know which is
            if (type == null || type == regexType)
            {
                //Loop through the regexes
                for (let i = 0; i < spoofaxElementRegex[regexType].length; i++) 
                {
                    var regexObject = spoofaxElementRegex[regexType][i];
                    var regex = regexObject["regex"];
                    var regexKey = regexObject["type"];

                    //If we find a match
                    if (regex.test(line))
                    {
                        curModel["type"] = regexType;

                        this.mapSpoofaxDslElement(regexKey, curModel, line, lineIndex, opType, modelId);
                    }

                    //If we've found a match or the line is a bracket or empty
                    if (regex.test(line) || line == '{' || line == '}' || line == '')
                    {
                        //Check if this line was marked as a comment before
                        var oldComment = this.getMappedElement("spoofax_line_index", lineIndex, curModel["children"]);
                        if (oldComment != null && oldComment["type"] == "comment")
                        {
                            //Remove the comment
                            curModel["children"].splice(curModel["children"].indexOf(oldComment), 1);
                        }
                        mapped = true;
                    }
                }
            }
        }

        //If we couldn't map the line
        if (!mapped)
        {
            //If this line was a element before
            var oldElement = tools.findInTree(curModel, ["spoofax_line_index"], lineIndex);
            if (oldElement != null)
            {
                if (oldElement["type"] != "comment")
                {
                    //Tell MPS to delete the element
                    this.parsafixToMpsEdit(oldElement, curModel, "deleteOp", (oldElement["parent_line_index"] == null), modelId, false)
                }

                //Remove the old element from the mapping
                var parentElement = tools.findInTree(curModel, ["spoofax_line_index"], oldElement["parent_line_index"]);
                if (parentElement == null)
                {
                    parentElement = curModel;
                }
                parentElement["children"].splice(parentElement["children"].indexOf(oldElement), 1);
            }

            //Add the line as a comment
            this.editMappedElement(curModel["children"], "spoofax_line_index", lineIndex, { "text":line, "type":"comment", "parent_line_index":null }, type)
        }
    }

    //-------------------------------------------------------------------------------
    // Maps a Spoofax DSL element
    //-------------------------------------------------------------------------------
    mapSpoofaxDslElement(type, curModel, line, lineIndex, opType, modelId)
    {
        console.log("Mapping:", type, line, lineIndex, opType, modelId);

        var isRootNode = false;
        var isNewElement = false;

        switch (type) 
        {
            //If this is a root element
            case "root":
                if (!curModel.hasOwnProperty("children"))
                {
                    curModel["children"] = [];
                }

                var rootElementName = (line.substring(line.indexOf(type) + type.length).trim()).replaceAll('{', '').replaceAll('}', '').trim();
                isNewElement = this.editMappedElement(curModel["children"], "spoofax_line_index", lineIndex, 
                { 
                    "name":rootElementName, 
                    "type":type, 
                    "parent_line_index":null
                }, "dsl", true, line);

                isRootNode = true;
                break;
            //If this is a parent element
            case "parent":
                var parentRootElement = this.getMostLikelyParentElement(lineIndex, curModel["children"]);

                if (parentRootElement != null)
                {
                    var parentElementName = (line.substring(line.indexOf(type) + type.length).trim()).replaceAll('{', '').replaceAll('}', '').trim();
                    isNewElement = this.editMappedElement(parentRootElement["children"], "spoofax_line_index", lineIndex, 
                    { 
                        "name":parentElementName, 
                        "type":type, 
                        "parent_line_index":parentRootElement["spoofax_line_index"],
                        "parent_mps_id":parentRootElement["mps_id"]
                    }, "dsl", true, parentRootElement, line);
                }
                
                break;
            case "child":
                var parentRootElement = this.getMostLikelyParentElement(lineIndex, curModel["children"]);

                if (parentRootElement != null)
                {
                    var parentParentElement = this.getMostLikelyParentElement(lineIndex, parentRootElement["children"]);

                    if (parentParentElement != null)
                    {
                        var childElementName = (line.substring(line.indexOf(type) + type.length).trim()).replaceAll('{', '').replaceAll('}', '').trim();
                        isNewElement = this.editMappedElement(parentParentElement["children"], "spoofax_line_index", lineIndex, 
                        { 
                            "name":childElementName, 
                            "type":type, 
                            "parent_line_index":parentParentElement["spoofax_line_index"],
                            "parent_mps_id":parentParentElement["mps_id"]
                        }, "dsl", false, parentParentElement, line);
                    }
                }

                break;
        
            default:
                break;
        }

        var mappedElement = tools.findInTree(curModel, ["spoofax_line_index"], lineIndex, ["type"], ["comment"]);
        console.log(JSON.stringify(mappedElement)); 

        //Send changes to MPS
        this.parsafixToMpsEdit(mappedElement, curModel, opType, isRootNode, modelId, isNewElement);
    }

    //-------------------------------------------------------------------------------
    // Propogates a Parsafix data edit to MPS
    //-------------------------------------------------------------------------------
    parsafixToMpsEdit(editedElement, model, opType, isRootNode, modelId, isNewElement)
    {
        console.log("\nSending to MPS:", opType, isRootNode, modelId, isNewElement);
        console.log(JSON.stringify(editedElement));

        var editData = {
            "opType": opType,
            "isNewElement": isNewElement,
            "isRootNode": isRootNode
        };

        //If this is a new element
        if (isNewElement)
        {
            if (isRootNode)
            {
                var modelNode = tools.findInTree(this.mpsDataModel, ["data", "roleInParent"], "models");
                console.log(JSON.stringify(modelNode));
                if (modelNode == null) { return }
                editData["parentId"] = modelNode["data"]["id"];
            }
            else
            {
                editData["parentId"] = editedElement["parent_mps_id"];
            }
            editData["concept"] = editedElement["type"];
            editData["spoofax_line_index"] = editedElement["spoofax_line_index"];
            editData["modelId"] = modelId;
            
            //Tell MPS the property to edit
            var propertyToChange = "name";
            editData["property"] = propertyToChange

            //Tell MPS the new name
            editData[propertyToChange] = editedElement["name"];
        }
        //If we're editing an existing element
        else
        {
            //Tell MPS which node
            editData["nodeId"] = editedElement["mps_id"];

            //Tell MPS the property to edit
            var propertyToChange = "name";
            editData["property"] = propertyToChange

            //Tell MPS the new name
            editData[propertyToChange] = editedElement["name"];
        }

        //Emit the new MPS edit
        this.classEmitter.emit('mpsEdit', editData); 
    }

    //-------------------------------------------------------------------------------
    // Upates the local MPS tree to correspond with a mapped Spoofax edit (we receive this data from MPS after a Spoofax edit)
    //-------------------------------------------------------------------------------
    updateMpsTreeModel(data)
    {
        console.log("Updating MPS tree: " + JSON.stringify(data));

        switch (data["opType"]) 
        {
            case "AddNewChildOp":
                console.log("Assigning MPS ID: " + JSON.stringify(data));

                //Update the Parsafix data model (insert the new node's MPS ID)
                var element = tools.findInTree(this.parsafixDataModel[data["modelId"]], ["spoofax_line_index"], data["spoofax_line_index"], ["type"], ["comment"]);
                if (element != null)
                {
                    element["mps_id"] = data["mps_node"]["id"];
                
                    //If this is a root node
                    if (element["parent_mps_id"] == null)
                    {
                        //Set it as root node for the model
                        this.parsafixDataModel[data["modelId"]]["mps_root_id"] = data["mps_node"]["id"];
                    }
                }
                //Update the MPS data model
                var parentNode = tools.findInTree(this.mpsDataModel, ["data", "id"], data["mps_node"]["parentId"]);
                if (parentNode != null)
                {
                    parentNode["children"].push({
                        "leafHash": data["mps_node"]["leafHash"],
                        "nodeHash": data["mps_node"]["nodeHash"],
                        "children": [],
                        "data": {
                            "id": data["mps_node"]["id"],
                            "concept": data["mps_node"]["concept"],
                            "parentId": data["mps_node"]["parentId"],
                            "roleInParent": data["mps_node"]["roleInParent"],
                            "childrenIds": [],
                            "properties": data["mps_node"]["properties"],
                            "references": []
                        }
                    });
                }
                //Emit the new Parsafix data
                this.classEmitter.emit('parsafix', _.cloneDeep(this.parsafixDataModel));
                break;
        
            case "DeleteNodeOp":
                //Remove the node from the local MPS tree
                var parentNode = tools.findInTree(this.mpsDataModel, ["data", "id"], data["mps_node"]["parentId"]);
                var nodeToDelete = tools.findInTree(parentNode, ["data", "id"], data["mps_node"]["id"]);
                if (parentNode != null && nodeToDelete != null)
                {   
                    parentNode["children"].splice(parentNode["children"].indexOf(nodeToDelete), 1);
                    parentNode["data"]["childrenIds"].splice(parentNode["data"]["childrenIds"].indexOf(data["mps_node"]["id"]), 1);
                }
                break;

            case "SetPropertyOp":
                //Update the node's hashes and properties
                var nodeToUpdate = tools.findInTree(this.mpsDataModel, ["data", "id"], data["mps_node"]["id"]);
                if (nodeToUpdate != null)
                {
                    nodeToUpdate["leafHash"] = data["mps_node"]["leafHash"],
                    nodeToUpdate["nodeHash"] = data["mps_node"]["nodeHash"],
                    nodeToUpdate["data"]["properties"] = data["mps_node"]["properties"]
                }

                console.log("Updated node: " + JSON.stringify(nodeToUpdate));
                break;
        }

        //Emit the new MPS tree data
        this.classEmitter.emit('mpsTree', _.cloneDeep(this.mpsDataModel));
    }

    //-------------------------------------------------------------------------------
    // Applies and edit to an element inside the Parsafix data model. Returns true if the element is new
    //-------------------------------------------------------------------------------
    editMappedElement(destinationArr, idKey, idValue, elementAttributes, type, children, parent, line)
    {
        //console.log(destinationArr, idKey, idValue, elementAttributes, type, children, parent, line);
        var element = this.getMappedElement(idKey, idValue, destinationArr);
        var newElement = false;

        //If the element doesn't exist in the mapping yet or it used to be a comment
        if (element == null || element["type"] == "comment")
        {
            element = {}
            element[idKey] = idValue;

            //If this element can have children
            if (children)
            {
                //Add an empty array on creation
                element["children"] = [];
            }

            destinationArr.push(element);
            newElement = true;
        }

        for (const key in elementAttributes) 
        {
            element[key] = elementAttributes[key];
        }

        return newElement;
    }

    //-------------------------------------------------------------------------------
    // Returns the mapped element with matching key
    //-------------------------------------------------------------------------------
    getMappedElement(key, value, elementArr)
    {
        for (let i = 0; i < elementArr.length; i++) 
        {
            if (elementArr[i].hasOwnProperty(key) && elementArr[i][key] == value)
            {
                return elementArr[i];
            }
        }

        return null;
    }

    //-------------------------------------------------------------------------------
    // Returns the parent element of a certain type closest to the child
    //-------------------------------------------------------------------------------
    getMostLikelyParentElement(childLineIndex, elementArr)
    {
        var difference = 999999;
        var foundParent = null;

        for (let i = 0; i < elementArr.length; i++) 
        {
            if (elementArr[i]["type"] != "comment" && elementArr[i].hasOwnProperty("spoofax_line_index") && elementArr[i]["spoofax_line_index"] < childLineIndex)
            {
                var curDif = Math.abs(elementArr[i]["spoofax_line_index"] - childLineIndex);

                if (curDif < difference)
                {
                    difference = curDif;
                    foundParent = elementArr[i];
                }
            }
        }

        return foundParent;
    }
}

//-------------------------------------------------------------------------------
// Make the class available
//-------------------------------------------------------------------------------
module.exports = {
    Parser
}