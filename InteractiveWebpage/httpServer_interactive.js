const http = require('http');
const readline = require('readline');
const fs = require('fs');
const { Server } = require("socket.io");
const { EventEmitter } = require('events');
const { prettyPrintJson } = require('pretty-print-json');
const tools = require('../tools');

//-------------------------------------------------------------------------------
// Parsafix HTTP server class
//-------------------------------------------------------------------------------
class HttpServer
{
    server;
    io;
    socketArr;

    htmlFile;
    cssFile;
    jsFile;

    mpsData;
    xmlData;
    parsafixData;
    spoofaxData;

    classEmitter;

    pendingDataModelUpdates = [];

    constructor(emitter) 
    {
        this.classEmitter = emitter;
        this.xmlData = '';
        this.parsafixData = '';
        this.spoofaxData = '';
        this.socketArr = [];

        fs.readFile('./www_interactive/index.html', function(err, data) 
        {
            if (err) { console.log("\nFile read error: " + err); }
            this.htmlFile = data;
        }.bind(this));
            
        fs.readFile('./www_interactive/style.css', function(err, data) 
        {
            if (err) { console.log("\nFile read error: " + err); }
            this.cssFile = data;
        }.bind(this));

        fs.readFile('./www_interactive/main.js', function(err, data) 
        {
            if (err) { console.log("\nFile read error: " + err); }
            this.jsFile = data;
        }.bind(this));   
        
        fs.readFile('./www_interactive/mps_ast.json', function(err, data) 
        {
            if (err) { console.log("\nFile read error: " + err); }
            this.mpsData = JSON.parse(data.toString());
        }.bind(this));   
    }

    //-------------------------------------------------------------------------------
    // Starts up HTTP server
    //-------------------------------------------------------------------------------
    start = function()
    { 
        this.server = http.createServer(this.requestListener.bind(this));
        this.server.listen(38101);
        this.handleIO();
    }

    handleIO()
    {
        this.io = new Server(this.server);
        this.io.on('connection', function(socket)
        {
            this.socketArr.push(socket);
            //console.log('\nA user is viewing the project translation data');
            socket.on('disconnect', () => 
            {
                //console.log('\nA user disconnected');
            });

            socket.on('spoofax-edit', function(data, opType, op, dir)
            {
                this.classEmitter.emit("spoofax-edit", data, opType, op, dir);
            }.bind(this));

            socket.on('spoofax-data', function(data)
            {
                this.io.emit("spoofax-data", data);
            }.bind(this));


            socket.on("add-child", function(id)
            {
                var parentNode = tools.findInTree(this.mpsData, ["data", "id"], id);
                console.log("Parent", parentNode);
                var concept = "GenericDSL.structure.Root";
                switch (parentNode["data"]["concept"]) 
                {
                    case "GenericDSL.structure.Root":
                        concept="GenericDSL.structure.Parent"
                        break;
                
                    case "GenericDSL.structure.Parent":
                        concept = "GenericDSL.structure.Child";
                        break;
                }

                this.handleMpsEdit(
                {
                    "opType": "insertOp",
                    "isNewElement":true,
                    "isRootNode":(parentNode["data"]["id"] == "0"),
                    "parentId":id,
                    "concept":concept,
                    "modelId":"model_0"
                }, false,
                function(newId)
                {
                    this.classEmitter.emit("mps-edit", "AddNewChildOp", newId, this.mpsData);
                }.bind(this));
            }.bind(this));

            socket.on("del-element", function(id)
            {
                var node = tools.findInTree(this.mpsData, ["data", "id"], id);

                this.handleMpsEdit(
                {
                    "opType": "deleteOp",
                    "isNewElement":false,
                    "isRootNode":(node["data"]["parentId"] == "0"),
                    "nodeId":id,
                    "modelId":"model_0",
                }, true);
                this.classEmitter.emit("mps-edit", "DeleteNodeOp", id, this.mpsData);
            }.bind(this));

            socket.on("edit", function(id, val)
            {
                var node = tools.findInTree(this.mpsData, ["data", "id"], id);

                this.handleMpsEdit(
                {
                    "opType": "insertOp",
                    "isNewElement":false,
                    "isRootNode":(node["data"]["parentId"] == "0"),
                    "nodeId":id,
                    "property":"name",
                    "name":val
                }, true, 
                function()
                {
                    this.classEmitter.emit("mps-edit", "SetPropertyOp", id, this.mpsData, ";;name");
                }.bind(this));
            }.bind(this));

        }.bind(this));
    }

    //-------------------------------------------------------------------------------
    // Stops HTTP server
    //-------------------------------------------------------------------------------
    stop = function()
    {
        try 
        {
            //Disconnect all clients
            for (let i = 0; i < this.socketArr.length; i++) 
            {
                this.socketArr[i].disconnect();
            }
            //Close the server
            this.server.close();
        } 
        catch (error) {}
    }

    //-------------------------------------------------------------------------------
    // Listens for HTTP requests and responds
    //-------------------------------------------------------------------------------
    requestListener(req, res)
    {
        //console.log("\nRequest received: ", req.url);

        switch (req.url) {
            case "/style.css":
                res.writeHead(200, {"Content-Type": "text/css"});
                res.end(this.cssFile);
                break;
            case "/main.js":
                res.writeHead(200, {"Content-Type": "text/javascript"});
                res.end(this.jsFile);
                break;
        
            default:
                res.writeHead(200, {"Content-Type": "text/html"});
                res.end(this.htmlFile);
                this.updateMpsData(this.mpsData);
                this.updateParsafixData(this.parsafixData);
                this.updateSpoofaxData(this.spoofaxData);
        }
    }

    //-------------------------------------------------------------------------------
    // Updates the MPS project data
    //-------------------------------------------------------------------------------
    updateMpsData(newData)
    {
        //console.log("\nUpdating MPS data");
        this.mpsData = newData;
        this.classEmitter.emit("mps-data", this.mpsData);
        this.io.emit('mps-data', '<pre>' + prettyPrintJson.toHtml(this.mpsData) + '</pre>', this.mpsData);
    }

    //-------------------------------------------------------------------------------
    // Returns HTML of an MPS AST element
    //-------------------------------------------------------------------------------
    buildAstElement(element)
    {
        var html = '<div class="' + element["data"]["roleInParent"] + '"><span>' + element["data"]["properties"] + '</span>'

        element["children"].forEach(child => {
            html += this.buildAstElement(child);
        });

        return html + '</div>';
    }

    //-------------------------------------------------------------------------------
    // Updates the Parsafix data
    //-------------------------------------------------------------------------------
    updateParsafixData(newData)
    {
        this.parsafixData = newData;
        this.io.emit('parsafix-data', '<pre>' + prettyPrintJson.toHtml(this.parsafixData) + '</pre>');
    }

    //-------------------------------------------------------------------------------
    // Updates the Spoofax project data
    //-------------------------------------------------------------------------------
    updateSpoofaxData(newData)
    {
        //console.log("\nUpdating Spoofax data: " + JSON.stringify(newData));
        this.spoofaxData = newData;
        this.io.emit('spoofax-data', this.spoofaxData);
    }

    //-------------------------------------------------------------------------------
    // Returns the MPS data
    //-------------------------------------------------------------------------------
    getMpsData()
    {
        return this.mpsData;
    }

    //-------------------------------------------------------------------------------
    // Update the MPS AST according to the incoming MPS edit
    //-------------------------------------------------------------------------------
    handleMpsEdit(data, updateParsafix, callback)
    {
        var nodeId = '';
        console.log("Incoming MPS edit: ", JSON.stringify(data));

        //The MPS edit gets triggered earlier, so we wait for that (not ideal)
        setTimeout(() => {
            var opType = data["opType"];

            switch (opType)
            {   
                case 'insertOp':
                    //If we need to add a new child
                    if (data["isNewElement"])
                    {
                        //Use the timestamp as the node ID;
                        nodeId = JSON.stringify(Date. now());
                        var parentNode = tools.findInTree(this.mpsData, ["data", "id"], data["parentId"]);

                        if (data["name"] == null)
                        {
                            data["name"] = '';
                        }

                        parentNode["data"]["childrenIds"].push(nodeId);
                        parentNode["children"].push({
                            "data":{
                                "id":nodeId,
                                "concept":this.getConceptString(data["concept"]),
                                "parentId":data["parentId"],
                                "childrenIds":[],
                                "properties":["name=" + data["name"]],
                            },
                            "children":[]
                        });

                        if (updateParsafix)
                        {
                            //Give the element in the Parsafix data model it's MPS id
                            var element = tools.findInTree(this.parsafixData["model_0"], ["spoofax_line_index"], data["spoofax_line_index"]);
                            element["mps_id"] = nodeId;

                            if (data["isRootNode"])
                            {
                                this.parsafixData["model_0"]["mps_root_id"] = nodeId;
                            }
                        }
                    }
                    //If this is a property edit
                    else
                    {
                        var node = tools.findInTree(this.mpsData, ["data", "id"], data["nodeId"]);

                        if (data["name"] == null)
                        {
                            data["name"] = '';
                        }
                        node["data"]["properties"] = ["name=" + data["name"]];

                        if (updateParsafix)
                        {
                            //Update the Parsafix data model too
                            var element = tools.findInTree(this.parsafixData["model_0"], ["mps_id"], data["nodeId"]);
                            element["name"] = data["name"];
                        }
                    }
                    break;
                case 'deleteOp':
                    var node = tools.findInTree(this.mpsData, ["data", "id"], data["nodeId"]);
                    console.log(node);
                    var parentNode = tools.findInTree(this.mpsData, ["data", "id"], node["data"]["parentId"]);
                    parentNode["data"]["childrenIds"].splice(parentNode["data"]["childrenIds"].indexOf(node["data"]["id"]), 1);
                    parentNode["children"].splice(parentNode["children"].indexOf(node), 1);
                    break;
                default:
                    break;
            }

            if (updateParsafix)
            {
                this.classEmitter.emit("parsafix-data", this.parsafixData);
                this.updateParsafixData(this.parsafixData);
            }

            this.updateMpsData(this.mpsData);
            this.classEmitter.emit("mps-data", this.mpsData);

            if (callback != null)
            {
                callback(nodeId);
            }
        },200);
    }

    //-------------------------------------------------------------------------------
    // Update the Spoofax code according to the incoming MPS edit
    //-------------------------------------------------------------------------------
    handleSpoofaxEdit(data)
    {
        console.log("Incoming Spoofax edit: ", JSON.stringify(data));
        switch (data["opType"]) 
        {
            case "SetPropertyOp":
                var lineArr = this.spoofaxData["model_0.dsl"].split('%0A');
                lineArr[data["lineIndex"]] = data["text"];
                var outputText = '';
                for (let i = 0; i < lineArr.length - 1; i++) 
                {
                    outputText += lineArr[i] + '%0A';
                }
                outputText += lineArr[lineArr.length - 1];
                if (lineArr[lineArr.length - 1].length == 0)
                { 
                    outputText += '%0A';
                }
                this.spoofaxData["model_0.dsl"] = outputText;
                break;
        
            default:
                break;
        }

        this.updateSpoofaxData(this.spoofaxData);
    }

    getConceptString(concept)
    {
        switch (concept) {
            case "root":
                return "GenericDSL.structure.Root";
            case "parent":
                return "GenericDSL.structure.Parent";
            case "child":
                return "GenericDSL.structure.Child";
            default:
                return concept;
        }
    }
}

//-------------------------------------------------------------------------------
// Make the following functions available
//-------------------------------------------------------------------------------
module.exports = {
    HttpServer
}