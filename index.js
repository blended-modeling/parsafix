const readline = require('readline');
const { EventEmitter } = require('events');

const webpage = require('./httpServer.js');

const modelix = require('./modelixClient.js');

const saros = require('./sarosClient.js');

const parsafix = require('./parser.js');

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
          
          //I added some commands for testing purposes:
          //MPS command
          case "mps":
            switch (answer[1]) 
            {
              case "insert":
                if (answer[2] == "add") //mps insert add <parentId> <concept> <isRootNode> <name value> <modelId>
                {
                  modelixClient.handleParsafixEdit({
                    "opType": "insertOp",
                    "isNewElement": true,
                    "parentId": answer[3],
                    "concept": answer[4],
                    "isRootNode": (answer[5] === "true"),
                    "spoofax_line_index": 0,
                    "property":"name",
                    "name":answer[6],
                    "modelId":answer[7]
                  });
                }
                else if (answer[2] == "set") //mps insert set <nodeId> <name value>
                {
                  modelixClient.handleParsafixEdit({
                    "opType": "insertOp",
                    "isNewElement": false,
                    "nodeId": answer[3],
                    "property":"name",
                    "name":answer[4]
                  });
                }
                break;
              case "delete":  //mps delete <nodeId>
                modelixClient.handleParsafixEdit({
                  "opType": "deleteOp",
                  "nodeId": answer[2]
                });
                break;
            
              default:
                break;
            }

          //Spoofax command
          case 'spoofax':
            switch (answer[1]) 
            {
              case 'AddNewChildOp': //spoofax AddNewChildOp <is new file> <file name> <text> <lineIndex> <reset project model>

                if (answer[6] === "true")
                {
                  sarosClient.proxy.projectModel["model_0.dsl"] = "";
                }

                sarosClient.proxy.handleParsafixEdit({
                    "opType":"AddNewChildOp",
                    "fileName":answer[3],
                    "isRootNode":answer[2] === "true",
                    "text":answer[4],
                    "lineIndex":answer[5]
                });
                break;
              case 'SetPropertyOp': //spoofax SetPropertyOp <lineIndex> <difIndex> <text> <reset project model>
                
                var difLength = 0;
                if (answer[4] != null)
                {
                  difLength = answer[4].length;
                }

                if (answer[5] === "true")
                {
                  sarosClient.proxy.projectModel["model_0.dsl"] = "";
                }

                sarosClient.proxy.handleParsafixEdit({
                  "opType":"SetPropertyOp",
                    "fileName":"model_0",
                    "difLength":difLength,
                    "lineIndex":answer[2],
                    "difIndex":answer[3],
                    "edit":answer[4]
                });

                break;
            
              default:
                break;
            }
            break;

          default:
              break;
        }
    });
});

//-------------------------------------------------------------------------------
// Start the HTTP server
//-------------------------------------------------------------------------------

www = new webpage.HttpServer();
www.start();

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
  if (sarosClient != null) { sarosClient.proxy.handleParsafixEdit(data); }

  //Display the new spoofax data on the webpage
  www.updateSpoofaxData(spoofaxProject);
});

//Upon receiving edit MPS data
parsafixListener.on("mpsEdit", function(data)
{
  //Send it to MPS
  if (modelixClient != null) { modelixClient.handleParsafixEdit(data); }
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
  sarosClient = new saros.SarosClient(sarosListener, false);
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