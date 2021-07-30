const readline = require('readline');
const { EventEmitter } = require('events');

const webpage = require('./httpServer_interactive.js');

const modelix = require('../modelixClient.js');

const saros = require('../sarosClient.js');

const parsafix = require('../parser.js');

//-------------------------------------------------------------------------------

var www = null;
var parser = null;
var modelixClient = null;
var sarosClient = null;

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
      console.log(answer);
      answer = answer.split(' ');

      switch (answer[0]) {
          case 'y':
            www.stop();
            if (modelixClient != null) { modelixClient.stop(); }
            if (sarosClient != null) { sarosClient.stop(); }
            rl.pause();
            break;

          default:
              break;
        }
    });
});

//-------------------------------------------------------------------------------
// Start the HTTP server
//-------------------------------------------------------------------------------

var webpageListener = new EventEmitter();
www = new webpage.HttpServer(webpageListener);
www.start();

webpageListener.on("spoofax-edit", function(data, opType, op, dir)
{
    //Parse it to Parsafix data
    parser.spoofaxToParsafix(data, opType, op, dir);
});

webpageListener.on("mps-data", function(data)
{
    //Parse it to Parsafix data
    parser.mpsDataModel = data;
});

webpageListener.on("parsafix-data", function(data)
{
    //Parse it to Parsafix data
    parser.parsafixDataModel = data;
    console.log("Updating to: " + JSON.stringify(data));
});

webpageListener.on("mps-edit", function(opType, nodeId, treeModel, op)
{
    parser.mpsOperation(opType, nodeId, treeModel, op);
})

//-------------------------------------------------------------------------------
// Instantiate the parser
//-------------------------------------------------------------------------------

var parsafixListener = new EventEmitter();
parser = new parsafix.Parser(parsafixListener);

//Upon receiving Parsafix data
parsafixListener.on("parsafix", function(data)
{
  //Display it on the webpage
  www.updateParsafixData(data);
});

//Upon receiving Spoofax data
parsafixListener.on("spoofax", function(data, spoofaxProject)
{
  //Send it to Spoofax
  //if (sarosClient != null) { sarosClient.proxy.handleParsafixEdit(data); }

  //Display the new spoofax data on the webpage
  www.updateSpoofaxData(spoofaxProject);

  www.handleSpoofaxEdit(data);
});

//Upon receiving edit MPS data
parsafixListener.on("mpsEdit", function(data)
{
  //Send it to MPS
  //if (modelixClient != null) { modelixClient.handleParsafixEdit(data); }

  //Send it to the webpage
  www.handleMpsEdit(data, true);
});

//Upon receiving tree MPS data
parsafixListener.on("mpsTree", function(data)
{
  //Display the new MPS data on the webpage
  www.updateMpsData(data);
});

//-------------------------------------------------------------------------------
// Start the Modelix client
//-------------------------------------------------------------------------------

if (process.argv.indexOf("mps") > -1)
{
  var modelixListener = new EventEmitter();
  modelixClient = new modelix.ModelixClient(modelixListener, false);
  modelixClient.start();

  //Upon receiving MPS project data
  modelixListener.on("data", function(data, opType, nodeId, op)
  {
    //Display it on the webpage
    www.updateMpsData(data);

    //If this isn't a specific operation
    if (opType == null)
    {
      //Parse all the data to Parsafix data
      parser.mpsToParsafix(data);
    }
    else
    {
      //Apply the edit
      parser.mpsOperation(opType, nodeId, data, op);
    }
  });

  //Upon receiving a new node ID
  modelixListener.on("mpsNodeUpdate", function(data)
  {
    //Assign it to the right element
    parser.updateMpsTreeModel(data);
  });
}

//-------------------------------------------------------------------------------
// Start the Saros client and the proxy server
//-------------------------------------------------------------------------------

if (process.argv.indexOf("spoofax") > -1)
{
  var sarosListener = new EventEmitter();
  sarosClient = new saros.SarosClient(sarosListener, true);
  sarosClient.start();

  //Upon receiving MPS project data
  sarosListener.on("data", function(data, opType, op, dir)
  {
    //Display it on the webpage
    www.updateSpoofaxData(data);

    //Parse it to Parsafix data
    parser.spoofaxToParsafix(data, opType, op, dir);
  });
}