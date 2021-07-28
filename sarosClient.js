const { client, xml } = require("@xmpp/client");
const debug = require("@xmpp/debug");
const fs = require('fs');
const { EventEmitter } = require('events');
const sarosProxy = require('./sarosProxy.js');

//-------------------------------------------------------------------------------

class SarosClient
{
    classEmitter;
    debug;

    service = "xmpp://localhost:5222" //the server IP and port of the XMPP server
    hostId = "admin"; //the username of the Saros host
    clientId = "parsafix"; //the username given to the Parsafix user on the XMPP server
    password = "parsafix" //the password belonging to the Parsafix user
    
    domain = "saroshost"; //the XMPP domain 
    sarosVersion = "16.0.1"; //the Version of Saros we're working with
    resource = "Saros"; //the resource tells the Saros host we're talking about Saros

    id_counter = 0;

    __v = null;
    __nid = null;
    __sarosSessionID = "saros-main-session:1234567891011121314";

    connectionEstablishmentID = null;

    xmpp = null;
    proxy = null;
    proxyPort = 7785;

    constructor(emitter, debugFlag)
    {
        this.classEmitter = emitter;
        this.debug = debugFlag;

        this.handleXMPP();

        var proxyListener = new EventEmitter();
        this.proxy = new sarosProxy.SarosProxy(proxyListener, this.proxyPort, debugFlag);

        //Upon receiving proxy data
        proxyListener.on("data", function(data, operationType, operation, dir)
        {
            this.classEmitter.emit('data', data, operationType, operation, dir);
        }.bind(this));

        this.proxy.start();
    }

    //-------------------------------------------------------------------------------
    // Handles contact with the XMPP server
    //-------------------------------------------------------------------------------
    handleXMPP()
    {
        this.xmpp = client({
            service: this.service, 
            domain: this.domain,
            resource: this.resource,
            username: this.clientId,
            password: this.password
        });

        if (this.debug)
        {
            debug(this.xmpp, true); //Turn debug mode on
        }

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; //Allow self-signed certificates

        //-------------------------------------------------------------------------------
        // When an XMPP error is returned
        //-------------------------------------------------------------------------------
        this.xmpp.on("error", (err) => {
            console.error("Error:", err);  
        });

        //-------------------------------------------------------------------------------
        // When an offline status is returned
        //-------------------------------------------------------------------------------
        this.xmpp.on("offline", () => {
            this.log("offline");
        });

        //-------------------------------------------------------------------------------
        // When a stanza is received and parsed
        //-------------------------------------------------------------------------------
        this.xmpp.on("stanza", function(stanza)
        {
            if (stanza.is("iq")) 
            {
                //Look at the Info/Query stanza type
                switch (stanza.attrs.type) {
                    case "get":
                        this.handleGetQuery(stanza);
                        break;
                    case "set":
                        this.handleSetQuery(stanza);
                        break;
                    case "result":
                        this.handleQueryResult(stanza)
                        break;

                    default:
                        this.log("Unknown IQ stanza type:\n" + stanza + "\n");
                        break;
                }
            }

            //If we've received a message
            else if (stanza.is("message"))
            {
                this.handleMessageStanza(stanza);
            }

            //If we've received a presence stanza
            else if (stanza.is("presence"))
            {
                this.handlePresenceStanza(stanza);
            }
        }.bind(this));

        //-------------------------------------------------------------------------------
        // When an online status is returned (authenticated and ready to receive stanzas)
        //-------------------------------------------------------------------------------
        this.xmpp.on("online", function(address)
        {
            //Anounce our presence 
            const presence = xml("presence", { id: this.newCustomID() }, xml("c", { xmlns: "http://jabber.org/protocol/caps", hash: "sha-1", node:"https://saros-project.org", ver:"fGKDyOA64N8UEuaqtqphGa5wERs=" }, ""));
            this.xmpp.send(presence);
        
            //Tell Saros that we're on the right Saros version (1 & 2)
            const version = xml("iq", { id: this.newCustomID(), to: this.fullHostJID(), type: "set" }, 
            xml("info", { xmlns: "saros" }, 
            xml("payload", { class: "INFO" },
            xml("data", {}, 
            xml("entry", {}, 
            [xml("string", {}, "version"), xml("string", {}, this.sarosVersion)])))));
        
            this.xmpp.send(version)
        }.bind(this));

        this.start();
    }

    //-------------------------------------------------------------------------------
    // Handles a get query received from the server
    //-------------------------------------------------------------------------------
    handleGetQuery(stanza)
    {
        //If the request has a query
        if (stanza.children[0].is("query"))
        {
            //Look at the query type
            switch (stanza.children[0].attrs.xmlns) 
            {
                case "http://jabber.org/protocol/disco#info":
                    const response = xml("iq", { id: stanza.attrs.id, to: this.fullHostJID(), type: "result" }, 
                    xml("query", { xmlns: "http://jabber.org/protocol/disco#info" }, 
                    '<identity category="client" name="https://saros-project.org" type="pc"/>'+
                    '<feature var="http://jabber.org/protocol/disco#items"/>' +
                    '<feature var="http://jabber.org/protocol/si/profile/file-transfer"/>' + 
                    '<feature var="urn:xmpp:ping"/><feature var="jabber:iq:last"/>' + 
                    '<feature var="http://jabber.org/protocol/commands"/>' +
                    '<feature var="http://jabber.org/protocol/muc"/>' + 
                    '<feature var="http://jabber.org/protocol/bytestreams"/>' +
                    '<feature var="http://jabber.org/protocol/ibb"/>' +
                    '<feature var="http://jabber.org/protocol/si"/>' +
                    '<feature var="http://jabber.org/protocol/xhtml-im"/>' +
                    '<feature var="http://jabber.org/protocol/chatstates"/>' +
                    '<feature var="http://jabber.org/protocol/disco#info"/>'));
                    this.xmpp.send(response);
                    break;
            
                default:
                    break;
            }
        }
        else
        {
            //this.log("IQ get stanza has no query:\n" + stanza + "\n");
        }
    }

    //-------------------------------------------------------------------------------
    // Handles a set query received from the server
    //-------------------------------------------------------------------------------
    handleSetQuery(stanza)
    {
        if (stanza.children[0].is("si"))
        {
            const si = xml("iq", { id: stanza.attrs.id, to: this.fullHostJID(), from: this.fullClientJID(), type:"result" }, '<si xmlns="http://jabber.org/protocol/si"><feature xmlns="http://jabber.org/protocol/feature-neg"><x xmlns="jabber:x:data" type="submit"><field var="stream-method"><value>http://jabber.org/protocol/bytestreams</value><value>http://jabber.org/protocol/ibb</value></field></x></feature></si>');
            this.xmpp.send(si);
        }
    }

    //-------------------------------------------------------------------------------
    // Handles a query result received from the server
    //-------------------------------------------------------------------------------
    handleQueryResult(stanza)
    {
        if (this.connectionEstablishmentID != null && stanza.attrs.id == this.connectionEstablishmentID)
        {
            this.log("\nCONNECTION ESTABLISHED\n");

            //Tell the host we're connected with an Connection Established Extension (9)
            const coes = xml("message", { id: this.newCustomID(), to: this.fullHostJID() }, 
            xml("coes", { xmlns: "saros" }, 
            xml("payload", { class: "COES", v:this.__v, nid:this.__nid }, "")));
            this.xmpp.send(coes);
        }
    }

    //-------------------------------------------------------------------------------
    // Handles stanza of type 'message'
    //-------------------------------------------------------------------------------
    handleMessageStanza(stanza)
    {
        //If this is a Session Negotiaton Offering (3a)
        if (stanza.children[0].is("snof"))
        {
            this.__v = stanza.children[0].children[0].attrs.v;
            this.__nid = stanza.children[0].children[0].attrs.nid;

            fs.writeFile('nid.txt', this.__nid, function (err) {
                if (err)
                {
                    this.log("File write error: " + err);
                }            
            });

            //Acknowledge the offering (3b)
            var responseID = this.upID(stanza.attrs.id);
            const snak = xml("message", { id: responseID, to: this.fullHostJID() }, 
            xml("snak", { xmlns: "saros" }, 
            xml("payload", { class: "SNAK", v:this.__v, nid:this.__nid }, "")));
            this.xmpp.send(snak)

            //Accept the Session Negotiation (4b)
            const snac = xml("message", { id: this.upID(responseID), to: this.fullHostJID() }, 
            xml("snac", { xmlns: "saros" }, 
            xml("payload", { class: "SNAC", v:this.__v, nid:this.__nid }, "")));
            this.xmpp.send(snac)

            //Session Negotiation Parameter Exchange (5b)
            const snpe = xml("message", { id: this.upID(responseID), to: this.fullHostJID() }, 
            xml("snpe", { xmlns: "saros" }, 
            xml("payload", { class: "SNPE", v:this.__v, nid:this.__nid },
            xml("settings", {},  
            [xml("entry", {}, [
                xml("string", {}, "resourceNegotiationTypeHook"), 
                xml("singleton-map", {}, [
                xml("entry", {}, [
                    xml("string", {}, "preferredResourceNegotiationType"),
                    xml("string", {}, "ARCHIVE")
                ])])]),
            xml("entry", {}, [
                xml("string", {}, "projectNegotiationTypeHook"), 
                xml("singleton-map", {}, [
                xml("entry", {}, [
                    xml("string", {}, "preferredProjectNegotiationType"),
                    xml("string", {}, "ARCHIVE")
                ])])]),
            xml("entry", {}, 
                [xml("string", {}, "colorManagement"), 
                xml("map", {}, 
                [xml("entry", {}, [xml("string", {}, "clientColor"), xml("string", {}, "-1")]), 
                xml("entry", {}, [xml("string", {}, "clientFavoriteColor"), xml("string", {}, "-1")])])])]))));
            this.xmpp.send(snpe) 
        }
        //If this is the host's response to the parameter exchange (6b)
        else if (stanza.children[0].is("snpe"))
        {
            //Inform the host about our bytestream proxy so it can establish a direct connection
            this.connectionEstablishmentID = this.newCustomID() 

            const iq = xml("iq", { id: this.connectionEstablishmentID, to: this.fullHostJID(), type: "set" }, 
            xml("query", { xmlns: "http://jabber.org/protocol/bytestreams", sid: this.__sarosSessionID, mode: "tcp" }, 
                xml("streamhost", { jid: this.fullClientJID(), port: this.proxyPort, host:'localhost',  }, "")
            ));

            this.xmpp.send(iq);
        }
    }

    //-------------------------------------------------------------------------------
    // Handles stanza of type 'presence'
    //-------------------------------------------------------------------------------
    handlePresenceStanza(stanza)
    {
        
    }

    //-------------------------------------------------------------------------------
    // Increments the given ID if it is of the form '<ID>-<number>'
    //-------------------------------------------------------------------------------
    upID(id)
    {
        try 
        {
            return id.split('-')[0] + '-' + (parseInt(id.split('-')[1]) + 1);
        } 
        catch (error) 
        {
            //Return a custom ID
            return this.newCustomID()
        }
    }

    fullHostJID()
    {
        return this.hostId + '@' + this.domain + '/' + this.resource;
    }

    fullClientJID()
    {
        return this.clientId + '@' + this.domain + '/' + this.resource;
    }

    //-------------------------------------------------------------------------------
    // Returns the next custom ID and increments the counter for the next one
    //-------------------------------------------------------------------------------
    newCustomID()
    {
        var newID = "customid_" + this.id_counter;
        this.id_counter++;
        return newID;
    }

    //-------------------------------------------------------------------------------
    // Starts up the XMPP connection to the given XMPP server
    //-------------------------------------------------------------------------------

    start = function()
    {
        this.xmpp.start().catch(console.error);
    }

    //-------------------------------------------------------------------------------
    // Closes the XMPP connection
    //-------------------------------------------------------------------------------

    stop = function()
    {
        this.xmpp.stop().catch(this.log(""));
        this.proxy.stop();
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
// Make the class available
//-------------------------------------------------------------------------------
module.exports = {
    SarosClient
}