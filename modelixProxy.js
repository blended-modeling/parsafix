const net = require('net');
const sha1 = require('js-sha1');
const zlib = require('zlib');
const fs = require('fs');
const parseString = require('xml2js').parseString;
const readline = require('readline');

//-------------------------------------------------------------------------------

var server = null;
var socket = null;
var modSock = null;

//-------------------------------------------------------------------------------
// Starts up the proxy server
//-------------------------------------------------------------------------------
const start = function()
{
    var http = require('http');
    var httpProxy = require('http-proxy');

    //
    // Create a proxy server with custom application logic
    //
    var proxy = httpProxy.createProxyServer({});

    // assign events
    proxy.on('proxyRes', function (proxyRes, req, res) {

        // collect response data
        var proxyResData='';
        proxyRes.on('data', function (chunk) {
            proxyResData +=chunk;
        });
        proxyRes.on('end',function () {


            var snifferData =
            {
                request:{
                    data:req.body,
                    headers:req.headers,
                    url:req.url,
                    method:req.method},
                response:{
                    data:proxyResData,
                    headers:proxyRes.headers,
                    statusCode:proxyRes.statusCode}
            };
            console.log(snifferData);

            fs.appendFile('proxyTraffic.txt', '\n' + JSON.stringify(snifferData) + '\n', function (err) 
            {
                if (err)
                {
                    console.log("File write error: " + err);
                }            
            });
        });
    });


    proxy.on('proxyReq', function(proxyReq, req, res, options) {
        // collect request data
        req.body='';
        req.on('data', function (chunk) {
            req.body +=chunk;
        });
        req.on('end', function () {
        });

    });

    proxy.on('error',
        function(err)
        {
            console.error(err);
        });

    // run the proxy server
    var server = http.createServer(function(req, res) {

        // every time a request comes proxy it:
        proxy.web(req, res, {
            target: 'http://localhost:28101'
        });

    });

    console.log("listening on port 28102")
    server.listen(28102);
}

function openModelixSocket()
{
    modSock = new net.Socket();

    modSock.connect({
        port: 28101,
        host: 'localhost'
    });

    modSock.on('error', function(error)
    {
        console.log("\nERROR:\n", error);
    });

    modSock.on('connect', function()
    {
        console.log("\nCONNECTED to model server: ", modSock.address(), "\n");
    });

    modSock.on('data', function(data)
    {
        console.log("\nDATA (" + data.length + ") Model Server:\n", data, "\n", data.toString());

        passToClient(socket, data)
    })

    modSock.on('close', function()
    {
        console.log("\nCLOSED connection to model server!\n");
    });
}

function passToModelServer(conn, data)
{
    conn.write(data);
}

function passToClient(conn, data)
{
    conn.write(data);
}

start();

const stop = function()
{
    try 
    {
        socket.destroy();
        modSock.destroy();
        server.close();
        rl.pause();
    } 
    catch (error) {}
    
}

//-------------------------------------------------------------------------------
// Make the following functions available
//-------------------------------------------------------------------------------

module.exports = {
    start, stop
}

//-------------------------------------------------------------------------------

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
//-------------------------------------------------------------------------------
// When the user presses enter
//-------------------------------------------------------------------------------
rl.on('line', (input) => 
{
    console.log(`Received: ${input}`);
});


//-------------------------------------------------------------------------------
// On terminal input C^
//-------------------------------------------------------------------------------
rl.on('SIGINT', () => {
    rl.question('Are you sure you want to exit? (y/n) ', (answer) => 
    {
        if (answer.match(/^y(es)?$/i))
        {
            stop();
        } 
    });
});

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  };