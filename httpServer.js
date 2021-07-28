const http = require('http');
const readline = require('readline');
const fs = require('fs');
const { Server } = require("socket.io");
const { prettyPrintJson } = require('pretty-print-json');

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

    constructor() 
    {
        this.mpsData = '';
        this.xmlData = '';
        this.parsafixData = '';
        this.spoofaxData = '';
        this.socketArr = [];

        fs.readFile('./www/index.html', function(err, data) 
        {
            if (err) { console.log("\nFile read error: " + err); }
            this.htmlFile = data;
        }.bind(this));
            
        fs.readFile('./www/style.css', function(err, data) 
        {
            if (err) { console.log("\nFile read error: " + err); }
            this.cssFile = data;
        }.bind(this));

        fs.readFile('./www/main.js', function(err, data) 
        {
            if (err) { console.log("\nFile read error: " + err); }
            this.jsFile = data;
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
                //this.updateXmlData(this.xmlData);
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
        this.io.emit('mps-data', '<pre>' + prettyPrintJson.toHtml(this.mpsData) + '</pre>');
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

    getMpsData()
    {
        return this.mpsData;
    }
}

//-------------------------------------------------------------------------------
// Make the following functions available
//-------------------------------------------------------------------------------
module.exports = {
    HttpServer
}