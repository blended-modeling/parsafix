const net = require('net');
const zlib = require('zlib');
const fs = require('fs');
const parseString = require('xml2js').parseString;
const readline = require('readline');
const tools = require('./tools');
const _ = require('lodash');

//-------------------------------------------------------------------------------

class SarosProxy
{
    client = "parsafix%40saroshost%2FSaros";

    classEmitter;
    debug;

    server = null;
    socket = null;
    proxyPort = null;

    socksConnection;
    greeting;
    request;
    userList;

    nid;
    projectID;
    sid;

    lockResponse;

    projectModel;
    fileEdits;

    seq;

    previousOp = '';

    constructor(emitter, proxyPort, debugFlag)
    {
        this.classEmitter = emitter;
        this.debug = debugFlag;

        this.proxyPort = proxyPort;

        this.projectModel = {};
        this.fileEdits = {};

        this.seq = 0;
    }

    //-------------------------------------------------------------------------------
    // Handles a SOCKS5 handshake between the client (the Saros host) and the proxy
    //-------------------------------------------------------------------------------
    handleHandshake(data)
    {
        //If we have not yet received a greeting
        if (!this.greeting)
        {
            //Assume this is a greeting
            this.log("\n-- INCOMING GREETING --");
            this.log("SOCKS version: " + data[0]);
            this.log("NAUTH: " + data[1]);
            this.log("AUTH: " + data[2]);

            //Tell the client we're on SOCKS version 5 
            //and that there is no authentication required
            var responseBuf = Buffer.from([5,0]);
            this.log("Response: ", responseBuf, "\n");

            this.greeting = true;
            this.socket.write(responseBuf);
        }
        //If we have not yet receive request details
        else if (!this.request)
        {
            //Assume these are the request details
            this.log("\n-- INCOMING REQUEST DETAILS --");
            this.log("SOCKS version: " + data[0]);
            this.log("CMD: " + data[1]);
            this.log("RSV: " + data[2]);
            this.log("ATYP (address type): " + data[3]);
            this.log("Length of domain name: " + data[4]);

            var bufferJSON = JSON.parse(JSON.stringify(data));
            var dataArr = bufferJSON["data"];
            var dstAddrArr = []
            for (var index = 5; index < dataArr.length - 2; index++) { dstAddrArr.push(dataArr[index]) }
            var dstAddr = Buffer.from(dstAddrArr);
            this.log("Destination address: " + dstAddr.toString() + " (" + dstAddrArr.length + ")");
            this.log("Destination port: " + dataArr[dataArr.length - 2] + dataArr[dataArr.length - 1]);

            //Respond by returning the SOCKS version, success, RSV field (0), domainname ATYP and the payload we just received 
            var responseBuf = Buffer.concat([Buffer.from([5, 0, 0, 3]), Buffer.from(dataArr.slice(4, dataArr.length))]);
            this.log("Response: ", responseBuf);

            this.request = true;
            this.socket.write(responseBuf);

            //-------------------------------------------------------------------------------------------------------

            //Next we tell the Saros host that we've successfully completed the session negotiation

            //Namespace update:
            var NSU = Buffer.concat([Buffer.from('64', 'hex'), Buffer.from('0000057361726f73', 'hex')]);
            //Element name update
            var ENU = Buffer.concat([Buffer.from('65', 'hex'), Buffer.from('00000005736e636d70', 'hex')]);
            //Transfer Description
            var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000001', 'hex')]);
            //Data
            fs.readFile('./nid.txt', 'utf8', function (err,data) 
            {
                if (err) {
                    return this.log(err);
                }

                this.nid = data;

                var xml = '<sncmp xmlns="saros"><payload class="saros.communication.extensions.InvitationCompletedExtension" v="SPXV1" nid="' + data + '"/></sncmp>';
                this.log("\nOUT:\n----\n" + xml);

                this.send(false, NSU, ENU, TFD, xml, function()
                {
                    //We'll consider the SOCKS connection properly established at this point
                    this.socksConnection = true;
                }.bind(this));
            }.bind(this));
        }
    }

    //-------------------------------------------------------------------------------
    // Handles incoming bytestream
    //-------------------------------------------------------------------------------
    handleBytestream(data)
    {
        //If there is data
        if (data.length > 0)
        {
            //Look at the Operation Code (the first byte)
            switch (data[0]) {
                //Namespace update (0x64)
                case 100:
                    this.handleNamespaceUpdate(data);
                    break;
                //Element name update (0x65)
                case 101:
                    this.handleElementNameUpdate(data);
                    break;
                //Transfer description (0xFA)
                case 250:
                    this.handleTransferDescription(data);
                    break;
                //Data (0xFB)
                case 251:
                    this.handleData(data);
                    break;
                default:
                    this.log("\nUNKNOWN OPERATION CODE!\n");
                    break;
            }
        }
    }

    //-------------------------------------------------------------------------------
    // Handles an incoming namespace update (0x64)
    //-------------------------------------------------------------------------------
    handleNamespaceUpdate(data)
    {
        var id = data.readUInt8(1); //1 byte 
        var nameLength = data.readInt16BE(2); //2 bytes
        var name = Buffer.from(data.slice(4, 4 + nameLength)).toString();

        this.log("\nNAMESPACE UPDATE:\n------------------\nID: " + id + "\nName: " + name);

        //Handle the rest of the bytestream
        this.handleBytestream(data.slice(4 + nameLength, data.length));
    }

    //-------------------------------------------------------------------------------
    // Handles an incoming element name update (0x65)
    //-------------------------------------------------------------------------------
    handleElementNameUpdate(data)
    {
        var id = data.readUInt16BE(1); //1 bytes
        var nameLength = data.readInt16BE(3); //2 bytes
        var name = Buffer.from(data.slice(5, 5 + nameLength)).toString();

        this.log("\nELEMENT NAME UPDATE:\n--------------------\nID: " + id + "\nName: " + name);

        //Handle the rest of the bytestream
        this.handleBytestream(data.slice(5 + nameLength, data.length))
    }

    //-------------------------------------------------------------------------------
    // Handles an incoming transfer description (0xFA)
    //-------------------------------------------------------------------------------
    handleTransferDescription(data)
    {
        var fragmentId = data.readInt16BE(1); //2 bytes
        var chunks = data.readInt32BE(3); //4 bytes
        var namespaceId = data.readUInt8(7); //1 byte
        var elementNameId = data.readUInt16BE(8); //
        var compressed = data.readUInt8(10);

        this.log("\nTRANSFER DESCRIPTION:\n---------------------\nFragment ID: " + fragmentId + "\nChunks: " + chunks + "\nNamespace ID: " + namespaceId + "\nElement name ID: " + elementNameId + "\nCompressed: " + (!!+compressed));

        //Handle the rest of the bytestream
        this.handleBytestream(data.slice(11, data.length))
    }

    //-------------------------------------------------------------------------------
    // Handles incoming data (0xFB)
    //-------------------------------------------------------------------------------
    handleData(data)
    {
        var fragmentId = data.readInt16BE(1);
        var payloadLength = data.readInt32BE(3);
        var payloadBuf = data.slice(7, 7 + payloadLength);

        zlib.inflate(payloadBuf, function(err, buffer)
        {
            var payload = buffer.toString('utf8');
            this.log("\nDATA:\n--------\nFragment ID: " + fragmentId + "\nPayload length: " + payloadLength + "\nPayload:\n" + payload + "\n");
            this.handleXML(payload);
        }.bind(this));
    }

    //-------------------------------------------------------------------------------
    // Handles received XML data
    //-------------------------------------------------------------------------------
    handleXML(xmlString)
    {
        //console.log(xmlString);

        //Parse the XML
        parseString(xmlString, function (err, result) 
        {
            if (err) 
            {
                return this.log("XML parsing error: " + err);
            }

            var xmlType = Object.keys(result)[0];

            switch (xmlType) {
                case 'ulsup':
                    this.handleUserList(result);
                    break;
                case 'ados':
                    this.handleActivitiesExtension(result);
                    break;
                case 'pnof':
                    this.handleProjectNegotiationOffering(result);
                    break;
                case 'saqrq':
                    this.handleActivityQueuingRequest(result);
                    break;
                case 'ping':
                    this.handlePing(result);
            
                default:
                    break;
            }
        }.bind(this));
    }

    //-------------------------------------------------------------------------------
    // Handles received ping
    //-------------------------------------------------------------------------------
    handlePing(xml)
    {
        var sid = xml["ping"]["payload"][0]["$"]["sid"];

        //Element name update
        var ENU = Buffer.concat([Buffer.from('65', 'hex'), Buffer.from('00050004706f6e67', 'hex')]);
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000501', 'hex')]);
        //Data
        var xml = '<pong xmlns="saros"><payload class="PONG" v="SPXV1" sid="' + sid + '"/></pong>';
        this.log("\nOUT:\n----\n" + xml);
        
        // Deflate the XML
        zlib.deflate(xml, (err, xmlBuffer) => {
            var DATA = Buffer.concat([Buffer.from('fb', 'hex'), Buffer.from('0000000000', 'hex'), Buffer.from([xmlBuffer.length], 'hex'), xmlBuffer]);

            var responseBuf = Buffer.concat([ENU, TFD, DATA]);
            this.socket.write(responseBuf);
        });
    }

    //-------------------------------------------------------------------------------
    // Handles received user list data
    //-------------------------------------------------------------------------------
    handleUserList(xml)
    {
        //Get the session ID
        var sid = xml["ulsup"]["payload"][0]["$"]["sid"];
        //Element name update
        var ENU = Buffer.concat([Buffer.from('65', 'hex'), Buffer.from('00010006756c73757073', 'hex')]);
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000101', 'hex')]);
        //Data
        var xml = '<ulsups xmlns="saros"><payload class="ULSUPS" v="SPXV1" sid="' + sid + '"/></ulsups>';
        this.log("\nOUT:\n----\n" + xml);
        
        // Deflate the XML
        zlib.deflate(xml, (err, xmlBuffer) => {
            var DATA = Buffer.concat([Buffer.from('fb', 'hex'), Buffer.from('0000000000', 'hex'), Buffer.from([xmlBuffer.length], 'hex'), xmlBuffer]);

            this.userList = true;
            var responseBuf = Buffer.concat([ENU, TFD, DATA]);
            this.socket.write(responseBuf);

            //We'll consider the SOCKS connection properly established at this point
            this.socksConnection = true;
        });
        
    }

    //-------------------------------------------------------------------------------
    // Handles received activities extension data
    //-------------------------------------------------------------------------------
    handleActivitiesExtension(xml)
    {
        //  ---------
        //  EXAMPLES:
        //  ---------
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="15"><editorActivity source="admin%40saroshost%2FSaros" type="ACTIVATED"><p i="1107992100" p="printer_example.oil"/></editorActivity></payload></ados>     
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="48"><editorActivity source="admin%40saroshost%2FSaros" type="SAVED"><p i="1107992100" p="printer_example.oil"/></editorActivity></payload></ados>
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="92"><editorActivity source="admin%40saroshost%2FSaros" type="CLOSED"><p i="1107992100" p="printer_example.oil"/></editorActivity></payload></ados>        

        //  <ados xmlns="saros">
        //      <payload class="ADOS" v="SPXV1" sid="992386670" seq="18">
        //          <textSelectionActivity source="admin%40saroshost%2FSaros" sl="0" so="6" el="0" eo="6"><p i="1938292666" p="temp.oil"/></textSelectionActivity>
        //          <jupiterActivity source="admin%40saroshost%2FSaros"><p i="1938292666" p="temp.oil"/>
        //              <t class="vectorTime" local="6" remote="0"/><o class="insertOp" sl="0" so="6" ld="0" od="1" ol="0" oo="6"><text>5</text></o>
        //          </jupiterActivity>
        //      </payload>
        //  </ados>

        var sid = xml["ados"]["payload"][0]["$"]["sid"];
        var activityTypes = [];

        //Get the activity type
        for (const key in xml["ados"]["payload"][0]) 
        {
            if (key != "$")
            {
                activityTypes.push(key);
            }
        }

        for (let i = 0; i < activityTypes.length; i++) 
        {
            var activity = xml["ados"]["payload"][0][activityTypes[i]][0];

            switch (activityTypes[i]) {
                //A lock was requested/completed
                case 'stopActivity':
                    //Acknowledge the lock to let the host know that we will start no more activities until he gives the okay

                    //Element name update
                    var ENU = Buffer.concat([Buffer.from('65', 'hex'), Buffer.from('0003000461646f73', 'hex')]);
                    //Transfer Description
                    var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000301', 'hex')]);
                    //Data
                    var xmlResponse = '<ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="' + sid + '" seq="' + this.seq + '">'+
                    '<stopActivity source="' + activity["$"]["affected"] + '" initiator="' + activity["$"]["source"] + '" affected="' + activity["$"]["affected"] + '" type="' + activity["$"]["type"] + '" state="ACKNOWLEDGED" stopActivityID="' + activity["$"]["stopActivityID"] + '"/>'+
                    '</payload></ados>';
                        
                    this.log("\nOUT:\n----\n" + xmlResponse);

                    // Deflate the XML
                    zlib.deflate(xmlResponse, (err, xmlBuffer) => {
                        var DATA = Buffer.concat([Buffer.from('fb', 'hex'), Buffer.from('0000000000', 'hex'), Buffer.from([xmlBuffer.length], 'hex'), xmlBuffer]);
                        var responseBuf = Buffer.concat([ENU, TFD, DATA]);
                        this.socket.write(responseBuf);
                        this.seq++;
                    });
                    break;

                //A file was created/deleted/saved/etc.
                case 'fileActivity':
                    this.handleFileActivity(activity);
                    break;

                //A folder was created
                case 'folderCreated':
                //A folder was deleted
                case 'folderDeleted':
                    //Ignoring this for now
                    break;

                //A change was made to the contents of a file
                case 'jupiterActivity':
                    this.handleUserEdit(xml, false);             
                    break;
                
                case 'checksumActivity':
                    this.handleCheckSum(xml);
                    break;

                default:
                    break;
            }
        }        
    }

    //-------------------------------------------------------------------------------
    // Handles received project negotiation offering
    //-------------------------------------------------------------------------------
    handleProjectNegotiationOffering(xml)
    {
        var sid = xml["pnof"]["payload"][0]["$"]["sid"];
        this.sid = sid;
        var nid = xml["pnof"]["payload"][0]["$"]["nid"];
        var pnData = xml["pnof"]["payload"][0]["projectNegotiationData"][0]["PJNGDATA"][0];
        var projectID = pnData["$"]["pid"];
        this.projectID = projectID;
        var projectName = pnData["$"]["name"];
        var filelist = pnData["filelist"]
        var encodings = filelist[0]["encodings"];
        var files = filelist[0]["root"][0]["l"][0]["f"];

        //Element name update (pnmf)
        var ENU = Buffer.concat([Buffer.from('65', 'hex'), Buffer.from('00020004706e6d66', 'hex')]);
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000201', 'hex')]);

        //Data (tell the host we're not missing any files)
        //For now we're assuming that all files are created/edited/deleted while Parsafix is online
        var xml = '<pnmf xmlns="saros"><payload class="PNMF" v="SPXV1" sid="' + sid + '" nid="' + nid + '"><fileLists><FILELIST><projectID>' + projectID + '</projectID><encodings/><root p="" d="1"><l/></root></FILELIST></fileLists></payload></pnmf>';

        this.send(false, null, ENU, TFD, xml);
    }

    //-------------------------------------------------------------------------------
    // Handles received activity queuing request
    //-------------------------------------------------------------------------------
    handleActivityQueuingRequest(xml)
    {
        var sid = xml["saqrq"]["payload"][0]["$"]["sid"];
        var nid = xml["saqrq"]["payload"][0]["$"]["nid"];
        
        //Element name update
        var ENU = Buffer.concat([Buffer.from('65', 'hex'), Buffer.from('000400057361717270', 'hex')]);
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000401', 'hex')]);
        //Data
        var xml = '<saqrp xmlns="saros"><payload class="SAQRP" v="SPXV1" sid="' + sid + '" nid="' + nid + '"/></saqrp>';
        
        this.send(false, null, ENU, TFD, xml);
    }

    //-------------------------------------------------------------------------------
    // Handles file activity
    //-------------------------------------------------------------------------------
    handleFileActivity(activity)
    {
        //  ---------
        //  EXAMPLES:
        //  ---------
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="14"><fileActivity source="admin%40saroshost%2FSaros" type="CREATED" purpose="ACTIVITY"><p i="1107992100" p="printer_example.oil"/><content></content></fileActivity></payload></ados>
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="94"><fileActivity source="admin%40saroshost%2FSaros" type="REMOVED" purpose="ACTIVITY"><p i="1107992100" p="printer_example.oil"/></fileActivity></payload></ados>
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="12"><fileActivity source="admin%40saroshost%2FSaros" type="CREATED" purpose="ACTIVITY"><p i="1107992100" p="subfolder%2Fanother.oil"/><content></content></fileActivity></payload></ados>
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="94"><fileActivity source="admin%40saroshost%2FSaros" type="REMOVED" purpose="ACTIVITY"><p i="1107992100" p="printer_example.oil"/></fileActivity></payload></ados>
        
        var dir = activity["p"][0]["$"]["p"];
        var folderArr = dir.split('%2F');
        var fileName = folderArr[folderArr.length - 1];

        //If it's an .dsl file
        if (fileName.indexOf('.dsl') > -1)
        {
            switch (activity["$"]["type"]) 
            {
                case 'CREATED':
                    if (!this.projectModel.hasOwnProperty(dir))
                    {
                        this.projectModel[dir] = '';
                    }
                    break;

                case 'REMOVED':
                    if (this.projectModel.hasOwnProperty(dir))
                    {
                        delete this.projectModel[dir];
                    }
                    break;
            
                default:
                    break;
            }
        }

        //Emit the updated model and the operation
        //console.log(JSON.stringify(this.projectModel));
        this.classEmitter.emit('data', _.cloneDeep(this.projectModel), 'initialization');  
    }

    //-------------------------------------------------------------------------------
    // Handles received edit data
    //-------------------------------------------------------------------------------
    handleUserEdit(xml, fromParsafix)
    {
        var sid = xml["ados"]["payload"][0]["$"]["sid"];
        var activity = xml["ados"]["payload"][0]["jupiterActivity"][0];
        var source = activity["$"]["source"];
        var fileId = activity["p"][0]["$"]["i"];
        var dir = activity["p"][0]["$"]["p"];
        var folderArr = dir.split('%2F');
        var fileName = folderArr[folderArr.length - 1];
        var operation = activity["o"][0];
        var operationType = operation["$"]["class"];

        if (!this.projectModel.hasOwnProperty(dir))
        {
            this.projectModel[dir] = '';
        }

        switch (operationType) {
            case 'splitOp':
                //Loop through the split activities
                for (const op in activity["o"][0]) 
                {
                    if (op != '$')
                    {
                        //Act according to their type
                        switch (activity["o"][0][op][0]["$"]["class"]) 
                        {
                            case 'insertOp':
                                this.handleInsertOp(dir, activity["o"][0][op][0]);
                                break;
                
                            case 'deleteOp':
                                this.handleDeleteOp(dir, activity["o"][0][op][0]);
                                break;
                
                            default:
                                this.log("Unknown operation type within split operation: '" + operation[op][0]["$"]["class"] + "'");
                                break;
                        }
                    }
                }
                
                break;
            case 'insertOp':
                this.handleInsertOp(dir, operation);
                break;

            case 'deleteOp':
                this.handleDeleteOp(dir, operation);
                break;

            default:
                break;
        }
        
        //If this operation wasn't performed by Parsafix
        if (!fromParsafix)
        {
            this.updateFileEdits(fileName, null, false, null, true);

            console.log("Emitting update project model: " + JSON.stringify(this.projectModel));

            //Emit the updated model and the operation
            this.classEmitter.emit('data', _.cloneDeep(this.projectModel), operationType, operation, dir); 
        }
    }

    //-------------------------------------------------------------------------------
    // Handles insert operation
    //-------------------------------------------------------------------------------
    handleInsertOp(dir, activity)
    {
        //  --------
        //  EXAMPLE:
        //  --------
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="545293765" seq="47"><jupiterActivity source="admin%40saroshost%2FSaros"><p i="1107992100" p="printer_example.oil"/><t class="vectorTime" local="0" remote="0"/><o class="insertOp" sl="0" so="0" ld="0" od="24" ol="0" oo="0"><text>protocol+example_printer</text></o></jupiterActivity></payload></ados>

        /** 
         * --------
         * insertOp
         * --------
         * sl: start line                       index of the line (vertical)
         * so: start line offset                index of the position on the line (horizontal)
         * ld: line delta                       the number of line breaks (so the number of lines -1)
         * od: offset delta                     if ld == 0, then this is the horizontal offset index of the last character being added + 1 - the start line offset
         *                                      if ld > 0, then this is the offset index of the last character being added + 1
         * ol: origin start line                the original start line index that the insert operation was meant for (always the same as sl in our case)
         * oo: origin start in line offset      the original offset index that the insert operation was meant for (always the same as so in our case)
         * 
         * Note: all the indices apply to regular text, so e.g. with ')' instead of '%29'
        */

        var insertOp = activity["$"];
        var sl = parseInt(insertOp["sl"]);
        var so = parseInt(insertOp["so"]);

        var regularText = tools.sarosToRegularText(activity["text"][0]);
        this.log("Text to insert: " + regularText);

        var oldFileText = _.cloneDeep(this.projectModel[dir]);
        var regularOldFileText = tools.sarosToRegularText(oldFileText);

        var fileTextLineArr = regularOldFileText.split('\n');

        //If our offset is larger than the length of the string
        if (so > fileTextLineArr[sl].length)
        {
            //Some data probably didn't come through properly
            for (let i = 0; i < so - fileTextLineArr[sl].length; i++) 
            {
                //Fill it up
                fileTextLineArr[sl] += '?';
            }
        }

        fileTextLineArr[sl] = fileTextLineArr[sl].substr(0, so) + regularText + fileTextLineArr[sl].substr(so);

        var outputText = '';
        for (let i = 0; i < fileTextLineArr.length - 1; i++) 
        {
            outputText += fileTextLineArr[i] + '\n';
        }
        outputText += fileTextLineArr[fileTextLineArr.length - 1];
                
        this.projectModel[dir] = tools.regularToSarosText(outputText);
        this.log("Updated source code: " + JSON.stringify(this.projectModel[dir]));
    }

    //-------------------------------------------------------------------------------
    // Handles delete operation
    //-------------------------------------------------------------------------------
    handleDeleteOp(dir, activity)
    {
        //  --------
        //  EXAMPLE:
        //  --------
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="790749957" seq="24"><jupiterActivity source="admin%40saroshost%2FSaros"><p i="1510115590" p="temp.oil"/><t class="vectorTime" local="4" remote="0"/><o class="deleteOp" sl="1" so="0" ld="0" od="1"><replacedText>2</replacedText></o></jupiterActivity></payload></ados>

        /**
         * --------
         * deleteOp
         * -------- 
         * sl: start line           index of the line (vertical)
         * so: start line offset    index of the position on the line (horizontal)
         * ld: line delta           the number of line breaks (so the number of lines -1)
         * od: offset delta         if ld == 0, then this is the horizontal offset index of the last character being deleted - the start line offset
         *                          if ld > 0, then this is the horizontal offset index on the last character being deleted + 1
         * 
         * * Note: all the indices apply to regular text, so e.g. with ')' instead of '%29'
         */
                
        var deleteOp = activity["$"];
        var sl = parseInt(deleteOp["sl"]);
        var so = parseInt(deleteOp["so"]);

        var regularText = tools.sarosToRegularText(activity["replacedText"][0]);

        var oldFileText = _.cloneDeep(this.projectModel[dir]);
        var regularOldFileText = tools.sarosToRegularText(oldFileText);

        var fileTextLineArr = regularOldFileText.split('\n');

        fileTextLineArr[sl] = fileTextLineArr[sl].substr(0, so) + fileTextLineArr[sl].substr(so + regularText.length);

        var outputText = '';
        for (let i = 0; i < fileTextLineArr.length - 1; i++) 
        {
            outputText += fileTextLineArr[i] + '\n';
        }
        outputText += fileTextLineArr[fileTextLineArr.length - 1];
                
        this.projectModel[dir] = tools.regularToSarosText(outputText);
    }

    //-------------------------------------------------------------------------------
    // Keeps track of which files have been updated how many times by host and client
    //-------------------------------------------------------------------------------
    updateFileEdits(fileName, local, upLocal, remote, upRemote)
    {
        if (!this.fileEdits.hasOwnProperty(fileName))
        {
            this.fileEdits[fileName] = {
                "local":0,
                "remote":0
            }
        }

        if (local != null)
        {
            this.fileEdits[fileName]["local"] = parseInt(local);
        }
        else if (upLocal)
        {
            this.fileEdits[fileName]["local"] = parseInt(this.fileEdits[fileName]["local"]) + 1;
        }

        if (local != null)
        {
            this.fileEdits[fileName]["remote"] = parseInt(remote);
        }
        else if (upRemote)
        {
            this.fileEdits[fileName]["remote"] = parseInt(this.fileEdits[fileName]["remote"]) + 1;
        }
    }

    //-------------------------------------------------------------------------------
    // Handles received checksum data
    //-------------------------------------------------------------------------------
    handleCheckSum(xml)
    {
        //  ---------
        //  EXAMPLE:
        //  ---------
        //  <ados seq="17"><checksumActivity source="admin%40saroshost%2FSaros" hash="-1818988970" length="253"><p i="1270391084" p="test.oil"/><jupiterTimestamp class="vectorTime" local="1" remote="0"/></checksumActivity><checksumActivity source="admin%40saroshost%2FSaros" hash="-837325107" length="252"><p i="1270391084" p="printeri.oil"/><jupiterTimestamp class="vectorTime" local="1" remote="0"/></checksumActivity></payload></ados>

        var activity = xml["ados"]["payload"][0]["checksumActivity"][0];
        var timestamp = activity["jupiterTimestamp"][0]['$'];
        var fileName = activity["p"][0]["$"]["p"];

        //We are local and host is remote for us, so we flip what we get from the host
        this.updateFileEdits(fileName, timestamp["remote"], false, timestamp["local"], false);
    }

    //-------------------------------------------------------------------------------
    // Returns the text of a given file
    //-------------------------------------------------------------------------------
    getText(fileName)
    {
        if (this.projectModel.hasOwnProperty(fileName))
        {
            return this.projectModel[fileName];
        }
        
        return '';
    }

    //-------------------------------------------------------------------------------
    // Handles an edit received from Parsafix
    //-------------------------------------------------------------------------------
    handleParsafixEdit(data)
    {
        console.log("Saros received a Parsafix edit: " + JSON.stringify(data));
        console.log(this.projectModel);

        var opType = data["opType"];
        var fileName = data["fileName"];

        switch (opType)
        {   
            case 'AddNewChildOp':
                //If we need to add a new file
                if (data["isRootNode"])
                {
                    //Sometimes an insert operation is triggered twice
                    var newOp = JSON.stringify(data);
                    if (this.previousOp == newOp)
                    {
                        //I have no clue why, but it breaks things, so we prevent it
                        return;
                    }
                    this.previousOp = newOp;

                    //Create the file 
                    this.createFile(fileName);

                    //Give it a hot minute
                    setTimeout(() => {
                        this.activateEditing(fileName);

                        setTimeout(() => {
                            //Then add the root node text
                            this.insertText(fileName, data["text"], 0, 0);

                            setTimeout(() => {
                                //Save the edit
                                this.saveFile(fileName);

                                //Update the Spoofax project model
                                this.projectModel[fileName] = data["text"];
                            }, 200);
                        }, 200);
                    }, 200);
                }
                else
                {
                    //Add the node text (we add it to the previous line with a new line charater at the end,
                    //otherwise it doesn't want to create a new line if there is not already one there)
                    var previousLineRegularText = tools.sarosToRegularText(tools.getSpoofaxLine(this.projectModel, fileName, data["lineIndex"] - 1));
                    var text = '%0A' + data["text"]
                    var lineIndex = data["lineIndex"] - 1;

                    //If there is no previous line
                    if (previousLineRegularText == null) 
                    { 
                        //We do things normally
                        previousLineRegularText = ''; 
                        lineIndex = data["lineIndex"];
                        text = data["text"];
                    }

                    parseString(this.insertText(fileName, text, lineIndex, previousLineRegularText.length), function (err, result) 
                    {
                        //Update the Spoofax project model
                        this.handleUserEdit(result, true);
                    }.bind(this));

                    setTimeout(() => {
                        //Save the edit
                        this.saveFile(fileName);

                    }, 200);
                }
                break;
            case 'SetPropertyOp':
                //If text was added
                if (data["difLength"] > 0)
                {
                    parseString(this.insertText(fileName, data["edit"], data["lineIndex"], data["difIndex"]), function (err, result) 
                    {
                        //Update the Spoofax project model
                        this.handleUserEdit(result, true);
                    }.bind(this));
                }
                //If text was removed
                else if (data["difLength"] < 0)
                {
                    parseString(this.deleteText(fileName, data["edit"], data["lineIndex"], data["difIndex"]), function (err, result) 
                    {
                        //Update the Spoofax project model
                        this.handleUserEdit(result, true);
                    }.bind(this));
                }
                break;
            case 'DeleteNodeOp':
                break;
            case 'test':
                break;
            default:
                break;
        }
    }

    //-------------------------------------------------------------------------------
    // Activates editing of a given file
    //-------------------------------------------------------------------------------
    activateEditing(fileName)
    {
        //  --------
        //  EXAMPLE:
        //  --------
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="1062407019" seq="3"><editorActivity source="client1%40saroshost%2FSaros" type="ACTIVATED"><p i="548112649" p="statemachine.oil"/></editorActivity></payload></ados>
               
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000301', 'hex')]);
        //Data
        var xml = '<ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="' + this.sid + '" seq="' + this.seq + '"><editorActivity source="' + this.client + '" type="ACTIVATED"><p i="' + this.projectID + '" p="' + fileName + '"/></editorActivity></payload></ados>';
        
        this.send(true, null, null, TFD, xml);
    }

    //-------------------------------------------------------------------------------
    // Stop editing of a given file
    //-------------------------------------------------------------------------------
    stopEditing(fileName)
    {
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000301', 'hex')]);
        //Data
        var xml = '<ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="' + this.sid + '" seq="' + this.seq + '"><editorActivity source="' + this.client + '" type="CLOSED"><p i="' + this.projectID + '" p="' + fileName + '"/></editorActivity></payload></ados>';
        
        this.send(true, null, null, TFD, xml);
    }

    //-------------------------------------------------------------------------------
    // Creates a given file
    //-------------------------------------------------------------------------------
    createFile(fileName)
    {
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000301', 'hex')]);
        //Data
        var xml = '<ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="' + this.sid + '" seq="' + this.seq + '"><fileActivity source="' + this.client + '" type="CREATED" purpose="ACTIVITY"><p i="' + this.projectID + '" p="' + fileName + '"/><content></content></fileActivity></payload></ados>';
        console.log("Creating file: " + fileName);

        this.send(true, null, null, TFD, xml, function()
        {
            this.updateFileEdits(fileName, null, false, null, false);
        }.bind(this));
    }

    //-------------------------------------------------------------------------------
    // Inserts text at a given position into a given file
    //
    //      !!! ------------IMPORTANT------------ !!!
    //      New text has to be in regular text format
    //-------------------------------------------------------------------------------
    insertText(fileName, newText, sl, so)
    { 
        //  ---------
        //  EXAMPLES:
        //  ---------
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="1689140510" seq="15"><jupiterActivity source="client1%40saroshost%2FSaros"><p i="1456248953" p="statemachine.oil"/><t class="vectorTime" local="0" remote="0"/><o class="insertOp" sl="0" so="37" ld="0" od="1" ol="0" oo="37"><text>1</text></o></jupiterActivity></payload></ados>
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="790749957" seq="20"><jupiterActivity source="admin%40saroshost%2FSaros"><p i="1510115590" p="temp.oil"/><t class="vectorTime" local="3" remote="0"/><o class="insertOp" sl="0" so="0" ld="2" od="4" ol="0" oo="0"><text>1%0A2%0A+++4</text></o></jupiterActivity></payload></ados>
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="790749957" seq="35"><jupiterActivity source="admin%40saroshost%2FSaros"><p i="1510115590" p="temp.oil"/><t class="vectorTime" local="8" remote="0"/><o class="insertOp" sl="3" so="0" ld="3" od="2" ol="3" oo="0"><text>1%0A2%0A+++4%0A%095</text></o></jupiterActivity></payload></ados>
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="790749957" seq="9"><jupiterActivity source="admin%40saroshost%2FSaros"><p i="1510115590" p="temp.oil"/><t class="vectorTime" local="0" remote="0"/><o class="insertOp" sl="0" so="0" ld="3" od="6" ol="0" oo="0"><text>1%0A2%0A3%0A444444</text></o></jupiterActivity></payload></ados>

        /** 
         * --------
         * insertOp
         * --------
         * sl: start line                       index of the line (vertical)
         * so: start line offset                index of the position on the line (horizontal)
         * ld: line delta                       the number of line breaks (so the number of lines -1)
         * od: offset delta                     if ld == 0, then this is the horizontal offset index of the last character being added + 1 - the start line offset
         *                                      if ld > 0, then this is the offset index of the last character being added + 1
         * ol: origin start line                the original start line index that the insert operation was meant for (always the same as sl in our case)
         * oo: origin start in line offset      the original offset index that the insert operation was meant for (always the same as so in our case)
         * 
         * Note: all the indices apply to regular text, so e.g. with ')' instead of '%29'
        */

        console.log("Inserting text: " + newText);

        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000301', 'hex')]);

        var lineArr = newText.split('\n');
        var ld = lineArr.length - 1;
        var od = newText.length;
        if (ld > 0)
        {
            od = lineArr[lineArr.length - 1].length;
        }

        var local = 0;
        var remote = 0;
        if (this.fileEdits[fileName] != null) 
        {
            local = this.fileEdits[fileName]["local"];
            remote = this.fileEdits[fileName]["remote"];
        }

        var xml = '<ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="' + this.sid + '" seq="' + this.seq + '"><jupiterActivity source="' + this.client + '"><p i="' + this.projectID + '" p="' + fileName + '"/><t class="vectorTime" local="' + local + '" remote="' + remote + '"/>';
        xml += '<o class="insertOp" sl="' + sl + '" so="' + so + '" ld="' + ld + '" od="' + od + '" ol="' + sl + '" oo="' + so + '">';
        xml += '<text>' + newText + '</text></o></jupiterActivity></payload></ados>';

        console.log("Sending insert: " + xml);

        this.send(true, null, null, TFD, xml, function()
        {
            this.updateFileEdits(fileName, null, true, null, false);
        }.bind(this));

        return xml;
    }

    //-------------------------------------------------------------------------------
    // Deletes text at a given position from a given file
    //
    //      !!! ---------------IMPORTANT--------------- !!!
    //      Text to delete has to be in regular text format
    //-------------------------------------------------------------------------------
    deleteText(fileName, textToDelete, sl, so)
    {
        //  ---------
        //  EXAMPLE:
        //  ---------
        //  <ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="1155050194" seq="18"><jupiterActivity source="client1%40saroshost%2FSaros"><p i="1270391084" p="test.oil"/><t class="vectorTime" local="0" remote="1"/><o class="deleteOp" sl="0" so="0" ld="26" od="1"><replacedText>module+printer_module%0A%7B%0A%09interface+printer+%0A%09%7B%0A%09%09turn_on%28%29%0A%09%09turn_off%28%29%0A%09%09add_job%28%29%0A%09%09remove_job%28%29%0A%09%09print_job%28%29%0A%09%7D%0A%09%0A%09interface+newii+%0A%09%7B%0A%09%09swag%28%29%0A%09%09maybe%28%29%0A%09%09cool%28%29%0A%09%09swurg%28%29%0A%09%09something%28%29%0A%09%09boo%28%29%0A%09%09no%28%29%0A%09%09yes%28%29%0A%09%09mebbie5%28%29%0A%09%09hm%28%29%0A%09%09hi3%28%29%0A%09%09man%28%29%0A%09%7D%0A%7D</replacedText></o></jupiterActivity></payload></ados>
        
        /**
         * --------
         * deleteOp
         * -------- 
         * sl: start line           index of the line (vertical)
         * so: start line offset    index of the position on the line (horizontal)
         * ld: line delta           the number of line breaks (so the number of lines -1)
         * od: offset delta         if ld == 0, then this is the horizontal offset index of the last character being deleted - the start line offset
         *                          if ld > 0, then this is the horizontal offset index on the last character being deleted + 1
         * 
         * * Note: all the indices apply to regular text, so e.g. with ')' instead of '%29'
         */

        console.log("Text to delete from '" + fileName + "': " + textToDelete);

        if (textToDelete.length > 0)
        {
            var lineArr = textToDelete.split('\n');
            var ld = lineArr.length - 1;
            var od = textToDelete.length;
            if (ld > 0)
            {
                od = lineArr[lineArr.length - 1].length;
            }

            //Transfer Description
            var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000301', 'hex')]);
            //Data
            var xml = '<ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="' + this.sid + '" seq="' + this.seq + '"><jupiterActivity source="' + this.client + '"><p i="' + this.projectID + '" p="' + fileName + '"/><t class="vectorTime" local="' + this.fileEdits[fileName]["local"] + '" remote="' + this.fileEdits[fileName]["remote"] + '"/>';
            xml += '<o class="deleteOp" sl="' + sl + '" so="' + so + '" ld="' + ld + '" od="' + od + '"><replacedText>' + textToDelete + '</replacedText></o></jupiterActivity></payload></ados>';
            
            console.log("Sending delete: " + xml);
            
            this.send(true, null, null, TFD, xml, function()
            {
                this.updateFileEdits(fileName, null, true, null, false);
            }.bind(this));

            return xml;
        }
    }

    //-------------------------------------------------------------------------------
    // Saves a given file
    //-------------------------------------------------------------------------------
    saveFile(fileName)
    {
        //Transfer Description
        var TFD = Buffer.concat([Buffer.from('fa', 'hex'), Buffer.from('00000000000100000301', 'hex')]);
        //Data
        var xml = '<ados xmlns="saros"><payload class="ADOS" v="SPXV1" sid="' + this.sid + '" seq="' + this.seq + '"><editorActivity source="' + this.client + '" type="SAVED"><p i="' + this.projectID + '" p="' + fileName + '"/></editorActivity></payload></ados>';

        this.send(true, null, null, TFD, xml);
    }

    //-------------------------------------------------------------------------------
    // Sends XML data plus metadata to the host
    //-------------------------------------------------------------------------------
    send(upSequence, NSU, ENU, TFD, xml, callback)
    {
        this.log("\nOUT:\n----\n" + xml);

        // Deflate the XML
        zlib.deflate(xml, (err, xmlBuffer) => {
            //For some reason Saros wants a slightly different header
            var buf = xmlBuffer.toString('hex');
            buf = '78da' + buf.substr(4);
            xmlBuffer = Buffer.from(buf, 'hex');

            var dataLength = xmlBuffer.length.toString(16);
            while (dataLength.length < 8)
            {
                dataLength = '0' + dataLength;
            }

            var DATA = Buffer.concat([Buffer.from('fb', 'hex'), Buffer.from('0000', 'hex'), Buffer.from(dataLength, 'hex'), xmlBuffer]);

            var bufParts = [];

            if (NSU != null)
            {
                bufParts.push(NSU);
            }
            
            if (ENU != null)
            {
                bufParts.push(ENU);
            }
            
            bufParts.push(TFD);
            bufParts.push(DATA);
            
            var responseBuf = Buffer.concat(bufParts);
            
            this.socket.write(responseBuf);

            if (upSequence)
            {
                this.seq++;
            }

            if (callback != null)
            {
                callback();
            }
        });
    }

    //-------------------------------------------------------------------------------
    // Starts up the proxy server
    //-------------------------------------------------------------------------------
    start = function()
    {
        var server = net.createServer();

        server.listen({port: this.proxyPort}, function()
        {
            console.log('Proxy server listening to %j', server.address());
        });

        //---------------------------------------------------------------------------
        // When the proxy server returns a connection event
        //---------------------------------------------------------------------------
        server.on('connection', function(conn)
        {
            //Make the socket connection available to other functions
            this.socket = conn;

            this.socksConnection = false;
            this.greeting = false;
            this.request = false;
            this.userList = false;

            //-----------------------------------------------------------------------
            // Listen for data coming in over our connection
            //-----------------------------------------------------------------------
            conn.on('data', function(data)
            {                
                //If there is no current SOCKS5 connection
                if (!this.socksConnection)
                {
                    //Get one going
                    this.handleHandshake(data);
                }
                else
                {
                    //console.log('\nBytes: ' + data.toString('hex'));
                    this.handleBytestream(data);
                }
            }.bind(this))
        }.bind(this));

        this.server = server;
    }

    stop = function()
    {
        try 
        {
            if (this.socket != null)
            {
                this.socket.destroy();
            }

            if (this.server != null)
            {
                this.server.close();
            }
        } 
        catch (error) {}
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

        var fileName = "spoofax_" + date + ".log";

        fs.appendFile('logs/' + fileName, '\n' + time + ':\t' + message + '\n', function (err) 
        {
            if (err)
            {
                console.log("Log write error: " + err);
            }            
        });
    }
}

//-------------------------------------------------------------------------------
// Make the following functions available
//-------------------------------------------------------------------------------
module.exports = {
    SarosProxy
}