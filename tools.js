const crypto = require('crypto');

//-------------------------------------------------------------------------------
// Returns a node with a given value for a key if it exists
//-------------------------------------------------------------------------------
function findInTree(node, keysArr, value, exclusionKeysArr, exclusionArray)
{ 
    if (node != null)
    {
        var prop = getNestedProperty(node, keysArr);

        if (prop == value)
        {
            //If there are no nodes to exclude, or this isn't one of them
            if (exclusionArray == null || exclusionArray.indexOf(getNestedProperty(node, exclusionKeysArr)) == -1)
            {
                return node;
            }
        }

        if (node.hasOwnProperty("children")) 
        {
            for (let i = 0; i < node["children"].length; i++) 
            {
                var result = findInTree(node["children"][i], keysArr, value, exclusionKeysArr, exclusionArray);
                if (result != null)
                {
                    return result;
                }
            }
        }
    }

    return null;
}

//-------------------------------------------------------------------------------
// Returns a nested property
//-------------------------------------------------------------------------------
function getNestedProperty(object, keysArr)
{
  for (let i = 0; i < keysArr.length; i++) 
  {
    var hasProp = object.hasOwnProperty(keysArr[i]);

    if (hasProp)
    {
      if (i < keysArr.length - 1)
      {
        object = object[keysArr[i]];
      }
      else
      {
        return object[keysArr[i]];
      }
    }
    else
    {
      return null;
    }
  }
}

//-------------------------------------------------------------------------------
// Returns a node with a given value for a key if it exists from an internal node structure
//-------------------------------------------------------------------------------
function findInternalNode(internalNode, key, value)
{
    if (internalNode != null)
    {
        for (let i = 0; i < internalNode["nodes"].length; i++) 
        {
            var node = internalNode["nodes"][i];

            if (node.hasOwnProperty(key) && node[key] == value) 
            {
                return node;
            }

            if (node.hasOwnProperty("nodes")) 
            {
                return findInternalNode(node, key, value);
            }
        }
    }

    return null;
}

//-------------------------------------------------------------------------------
// Returns an array of a path to a node with a given key
//-------------------------------------------------------------------------------
function findPathToNode(internalNode, key, value)
{
    var path = [];

    if (internalNode != null)
    {
        for (let i = 0; i < internalNode["nodes"].length; i++) 
        {
            var node = internalNode["nodes"][i];

            if (node.hasOwnProperty(key) && node[key] == value) 
            {
                path.push(node);
                break;
            }

            if (node.hasOwnProperty("nodes")) 
            {
                var children = findPathToNode(node, key, value);
                if (children.length > 0)
                {
                    path.push(node);
                    path = path.concat(children)
                    break;
                }
            }
        }
    }

    return path;
}

//-------------------------------------------------------------------------------
// Replaces a hash in an internal node and updates dependent hashes
//-------------------------------------------------------------------------------
function updateInternalNode(internalNode, hash, update, updatedInternalNodesArr)
{
    var nodePath = findPathToNode(internalNode, "hash", hash);

    if (nodePath.length > 0)
    {
        nodePath[nodePath.length - 1]["hash"] = update;

        for (let i = nodePath.length - 2; i >= 0; i--) 
        {
            nodePath[i]["hash"] = getInternalNodeHash(nodePath[i]);
        }
    }

    //Fill the array with updated internal nodes (not the replaced leaf)
    if (updatedInternalNodesArr != null)
    {
        for (let i = 0; i < nodePath.length - 1; i++) 
        {
            if (updatedInternalNodesArr.indexOf(nodePath[i]) == -1)
            {
                updatedInternalNodesArr.push(nodePath[i]);
            }
        }
    }
}

//-------------------------------------------------------------------------------
// Returns the number of bits in a given integer
//-------------------------------------------------------------------------------
function bitCount(int) 
{
    if (typeof int == "string")
    {
        int = parseInt((int).toString(), 16);
    }

    let result = 0;
  
    while (int) 
    {
      result += int % 2;
      int = int >>> 1;
    };
  
    return result;
};

//-------------------------------------------------------------------------------
// Returns the physical index of a node based on its bitmap and logical index
//-------------------------------------------------------------------------------
function logicalToPhysicalIndex(bitmap, logicalIndex) 
{
    return bitCount(parseInt(bitmap, 16) & ((1 << logicalIndex) - 1));
}

//-------------------------------------------------------------------------------
// Returns true if the given bitmap and 1 << logicalindex have no corresponding bits
//-------------------------------------------------------------------------------
function isBitNotSet(bitmap, logicalIndex) 
{
    return (parseInt(bitmap, 16) & (1 << logicalIndex)) == 0;
}

//-------------------------------------------------------------------------------
// Returns the internal node bitmap of the new tree when adding a new child
//-------------------------------------------------------------------------------
const BITS_PER_LEVEL = 5;
const ENTRIES_PER_LEVEL = 1 << BITS_PER_LEVEL;
const LEVEL_MASK = -0x1 >>> 32 - BITS_PER_LEVEL;
const MAX_BITS = 64;
const MAX_SHIFT = MAX_BITS - BITS_PER_LEVEL;

//-------------------------------------------------------------------------------
// Adds or deletes a node in the HAMT and returns the internal node string
//-------------------------------------------------------------------------------
function put(key, shift, internalNode, newChildHash, newInternalNodeArr)
{
    var keyAsInt = parseInt(key, 16);
    var childIndex = keyAsInt >>> shift & LEVEL_MASK;
    var child = getChildNodeHash(internalNode, childIndex);

    //If there is no child at this logical index
    if (child == null)
    {
        //Return the internal node with the new child in its string
        return setChild(childIndex, newChildHash, internalNode, newInternalNodeArr);
    }
    //If there is already a child at this logical index
    else
    {
        //Return the internal node string with the updated/removed child
        return setChild(childIndex, put(key, shift + BITS_PER_LEVEL, child, newChildHash, newInternalNodeArr), internalNode, newInternalNodeArr);
    }
}

//-------------------------------------------------------------------------------
// Returns the leaf hash of the child at a given logical index in a node array
//-------------------------------------------------------------------------------
function getChildNodeHash(internalNode, logicalIndex)
{
    //If the bitmap does not have the logical index set yet
    if (isBitNotSet(internalNode["bitmap"], logicalIndex))
    {
        //There is no child
        return null;
    }
    //Return the child's hash
    var physicalIndex = logicalToPhysicalIndex(internalNode["bitmap"], logicalIndex);
    return internalNode["nodes"][physicalIndex];
}

//-------------------------------------------------------------------------------
// Set a child in the node hash array and returns the internal node string
//-------------------------------------------------------------------------------
function setChild(logicalIndex, childHash, internalNode, newInternalNodeArr)
{
    if (childHash == null)
    {
        return deleteChild(internalNode, logicalIndex);
    }

    //If this used to be just a leaf node
    if (!internalNode.hasOwnProperty("bitmap"))
    {
        //Make it an internal node
        internalNode["bitmap"] = '1';
        internalNode["nodes"] = [ { "hash": internalNode["hash"] } ];

        //Modelix needs to know about this new internal node!
        newInternalNodeArr.push(internalNode);
        console.log("Adding new internal node!!!------------------------------------------------");
        console.log(newInternalNodeArr);
    }

    //Get the physical index from the logical one -> the index in the node array
    var physicalIndex = logicalToPhysicalIndex(internalNode["bitmap"], logicalIndex);

    //If the old bitmap does not have the logical index set yet
    if (isBitNotSet(internalNode["bitmap"], logicalIndex))
    {
        //Create a new bitmap
        var bm = parseInt(internalNode["bitmap"], 16) | (1 << logicalIndex);
        //Put the new child in the array of nodes at its physical index
        internalNode["nodes"].splice(physicalIndex, 0, { "hash": childHash });
        //And make the new bitmap plus the new array the new internal node
        internalNode["bitmap"] = bm.toString(16);
    } 
    //If it does
    else 
    {
        //The internal node becomes the old bitmap plus the old array where the updated child replaces the old one
        internalNode["nodes"].splice(physicalIndex, 1, childHash);
    }

    //Update the hash of the internal node
    internalNode["hash"] = getInternalNodeHash(internalNode);

    console.log("New internal hash:");
    console.log(internalNode);
    console.log("Stringified: " + JSON.stringify(internalNode));

    return internalNode;
}

//-------------------------------------------------------------------------------
// Deletes a child from the node hash array and returns the internal node string
//-------------------------------------------------------------------------------
function deleteChild(internalNode, logicalIndex)
{
    if (isBitNotSet(internalNode["bitmap"], logicalIndex))
    {
        return;
    }

    //Get the physical index from the logical one -> the index in the node array
    var physicalIndex = logicalToPhysicalIndex(internalNode["bitmap"], logicalIndex);
    //Calculate the new bitmap
    var oldBm = parseInt(internalNode["bitmap"], 16);
    var indexShift = ~(1 << logicalIndex);
    var newBitmap = (oldBm & indexShift).toString(16);
    //If that leaves us with an empty array
    if (newBitmap == 0)
    {
        return null;
    }
    console.log("Deleting child: " + JSON.stringify(internalNode["nodes"][physicalIndex]));

    //Remove the child from the internal node array
    internalNode["nodes"].splice(physicalIndex, 1);
    //If that only leaves a single node in the internal node array
    if (internalNode["nodes"].length == 1) 
    {
        //Return only that child
        return internalNode["nodes"][0];
    } 
    //Otherwise return the internal node with its new bitmap
    else 
    {
        internalNode["bitmap"] = newBitmap;
        return internalNode;
    }
}

//-------------------------------------------------------------------------------
// Returns a an internal node hash
//-------------------------------------------------------------------------------
function getInternalNodeHash(internalNode)
{
    return hash(getInternalNodeString(internalNode));
}

//-------------------------------------------------------------------------------
// Returns a an internal node string of the form 'I/<bitmap>/<nodeHashArray>'
//-------------------------------------------------------------------------------
function getInternalNodeString(internalNode)
{
    var nodeString = '';
    for (let i = 0; i < internalNode["nodes"].length - 1; i++) 
    {
        nodeString += internalNode["nodes"][i]["hash"] + ',';
    }
    nodeString += internalNode["nodes"][internalNode["nodes"].length - 1]["hash"];

    return 'I/' + internalNode["bitmap"].toString(16) + '/' + nodeString;
}

//-------------------------------------------------------------------------------
// Ups a hex version number by 1 (as many times as you like)
//-------------------------------------------------------------------------------
function upVersion(oldVersion, times)
{
    var newVersion = parseInt(oldVersion, 16) + 1;

    if (times != null)
    {
        if (times > 1)
        {
            
            times--;
            return upVersion(newVersion.toString(16), times);
        }
        else
        {
            return newVersion.toString(16);
        }
    }
    else
    {
        return newVersion.toString(16);
    }
}

//-------------------------------------------------------------------------------
// Returns the custom Modelix SHA256 hash of a given input
//-------------------------------------------------------------------------------
function hash(input)
{
    var base64 = crypto.createHash('sha256').update(input).digest('base64');
    var hash = base64.substr(0,5) + '*' + base64.substr(5, base64.length - 6);
    hash = hash.replaceAll('/', '_').replaceAll('+', '-');
    return hash;
}

//-------------------------------------------------------------------------------
// Returns the current timestamp in the form that Modelix wants
//-------------------------------------------------------------------------------
function getTime()
{
    var timestamp = JSON.stringify(new Date());
    timestamp = escape(timestamp.substr(1, timestamp.length - 2));
    timestamp = timestamp.replace('Z', '111500');

    return timestamp;
}

//-------------------------------------------------------------------------------
// Ups a long number by  a given amount
//-------------------------------------------------------------------------------
function upLong(longString, index, tail)
{
    if (index == null)
    {
        index = longString.length - 1;
    }
    else if (index == -1)
    {
        var zeros = '';
        for (let i = 0; i < longString.length; i++) 
        {
            zeros += '0';
        }

        return '1' + zeros;
    }

    var upVal = parseInt(longString[index]) + 1;

    if (upVal == 10)
    {
        var zeros = '';
        for (let i = 0; i < longString.substr(index).length; i++) 
        {
            zeros += '0';
        }

        return upLong(longString, index - 1, zeros)
    }
    else
    {
        var result = longString.substr(0, index) + upVal;
        if (tail != null)
        {
            result += tail;
        }
        
        return result;
    }
}

//-------------------------------------------------------------------------------
// Returns 1 if long a is larger than b, 0 if they are equal and -1 if b is larger
//-------------------------------------------------------------------------------
function compareLong(a, b)
{
    if (a.length > b.length)
    {
        return 1;
    }
    else if (a.length < b.length)
    {
        return - 1;
    }
    else
    {
        for (let i = 0; i < a.length; i++) 
        {
            if (a[i] > b[i])
            {
                return 1;
            }
            else if (a[i] < b[i])
            {
                return -1;
            }
        }

        return 0;
    }
}

//-------------------------------------------------------------------------------
// Returns Saros's escaped version of a given text
//-------------------------------------------------------------------------------
function regularToSarosText(text)
{
    var sarosText = encodeURIComponent(text).replaceAll('!', '%21').replaceAll('(', '%28').replaceAll(')', '%29').replaceAll("'", '%27').replaceAll('.', '%2e').replaceAll('*', '%2a').replaceAll('~', '%7e');
    sarosText = sarosText.replaceAll('%20', '+');

    return sarosText;
}

//-------------------------------------------------------------------------------
// Returns MPS's escaped version of a given text
//-------------------------------------------------------------------------------
function sarosToMpsText(text)
{
    var mpsText = encodeURIComponent(text).replaceAll('!', '%21').replaceAll('(', '%28').replaceAll(')', '%29').replaceAll("'", '%27').replaceAll('.', '%2e').replaceAll('*', '%2a').replaceAll('~', '%7e');
    mpsText = mpsText.replaceAll('+', '%20');

    return mpsText;
}

//-------------------------------------------------------------------------------
// Returns regular text from Saros's escaped version
//-------------------------------------------------------------------------------
function sarosToRegularText(sarosText)
{
    var regularText = decodeURIComponent(sarosText);
    regularText = regularText.replaceAll('+', ' ');
    return regularText;  
}

//-------------------------------------------------------------------------------
// Returns the index of where a new line would go in a spoofax file
//-------------------------------------------------------------------------------
function getSpoofaxNewLineIndex(spoofaxData, dir)
{
    if (spoofaxData[dir] != null)
    {
        var lineArr = spoofaxData[dir].split('%0A');
        return lineArr.length;
    }
    else
    {
        return 0;
    }
}

//-------------------------------------------------------------------------------
// Returns a Spoofax text with the given line inserted at the given index
//-------------------------------------------------------------------------------
function putSpoofaxLine(spoofaxData, dir, lineIndex, line)
{
    if (spoofaxData[dir] != null)
    {
        var lineArr = sarosToRegularText(spoofaxData[dir]).split('\n');
        //Add in the line
        lineArr.splice(lineIndex, 1, sarosToRegularText(line));
        var outputText = '';
        //String all the lines together again
        for (let i = 0; i < lineArr.length - 1; i++) 
        {
            outputText += lineArr[i] + '\n';
        }
        outputText += lineArr[lineArr.length - 1];
        outputText = regularToSarosText(outputText);
        return outputText;
    }

    console.log("\nNon-existent spoofax file:");
    console.log(JSON.stringify(spoofaxData));
    console.log(dir);
    return '';
}

//-------------------------------------------------------------------------------
// Returns the text on a given line index of a given file
//-------------------------------------------------------------------------------
function getSpoofaxLine(spoofaxData, dir, lineIndex)
{
    if (spoofaxData[dir] != null)
    {
        var lineArr = spoofaxData[dir].split('%0A');
        return lineArr[lineIndex];
    }
    return null;
}

//-------------------------------------------------------------------------------
// Returns a JSON object of an MPS node's properties
//-------------------------------------------------------------------------------
function getMpsNodeProperties(node)
{
    var propJson = {};
    if (node["data"] != null)
    {
        for (let i = 0; i < node["data"]["properties"].length; i++) 
        {
            var propArr = node["data"]["properties"][i].split('=');
            propJson[propArr[0]] = propArr[1];
        }
    }
    return propJson;
}

//-------------------------------------------------------------------------------
// Returns the length of the change in an MPS name
//
// Note: for now we assume there is only 1 change somewhere in the name.
// It can be however long, but should only be 1 character at a time in practice
//-------------------------------------------------------------------------------
function getMpsEditOffset(editedElement, oldMpsProjectData, spoofaxData, dir)
{
    var oldMpsNode = findInTree(oldMpsProjectData, ["data", "id"], editedElement["mps_id"]);

    console.log("edited element: " + JSON.stringify(editedElement));

    if (oldMpsNode != null)
    {
        //Figure out what change has been made
        var oldName = getMpsNodeProperties(oldMpsNode)["name"];
        console.log("Old name:" + oldName);
        var newName = editedElement["name"];
        if (oldName == null)
        {
            oldName = '';
        }

        var difIndex = oldName.length;
        var difLength = 0;

        for (let c = 0; c < oldName.length; c++) 
        {
            var curSubstr = oldName.substr(0, c + 1);

            if (newName.startsWith(curSubstr))
            {
                head = curSubstr;
            }
            else
            {
                difIndex = c;
                break;
            }
        }
        for (let c = difIndex; c < newName.length + 1; c++) 
        {
            var curSubstr = newName.substr(c);

            if (oldName.substr(difIndex).endsWith(curSubstr))
            {
                difLength = c - difIndex
                if (newName.length < oldName.length)
                {
                    difLength -= Math.abs(newName.length - oldName.length);
                }
                break;
            }
        }

        //What was added/deleted?
        var edit = newName.substring(difIndex, difIndex + difLength);
        if (difLength < 0)
        {
            edit = oldName.substr(difIndex, Math.abs(difLength));
        }

        var line = getSpoofaxLine(spoofaxData, dir, editedElement["spoofax_line_index"]);
        console.log(line, difIndex);
        var offset = difIndex - 1 + getSpoofaxNameOffset(editedElement, line); //Where the name of the element begins + the index we calculated

        return {
            "difIndex": offset,
            "difLength": difLength,
            "oldText": oldName,
            "edit": edit
        };
    }
    else
    {
        console.log("Error: could not find old MPS node; " + JSON.stringify(editedElement));
        console.log(JSON.stringify(oldMpsProjectData));
        return null;
    }
}

//-------------------------------------------------------------------------------
// Generates a DSL line for Spoofax from the project data
//-------------------------------------------------------------------------------
function generateSpoofaxDslLine(element, isNew, line)
{
    var name = element["name"];
    if (name == null)
    {
        name = '';
    }

    var indentation = '';

    if (isNew)
    {
        switch (element["type"]) {
            case "parent":
                indentation = '    ';
                break;
            case "child":
                indentation = '        ';
                break;
        }
    }
    else
    {
        var spaces = getSpoofaxTypeOffset(element, line);
        for (let i = 0; i < spaces; i++) {
            indentation += ' ';
        }
    }

    return regularToSarosText(indentation + element["type"] + ' ' + name);
}

//-------------------------------------------------------------------------------
// Returns the offset of where a element's name begins
//-------------------------------------------------------------------------------
function getSpoofaxTypeOffset(element, line)
{
    if (hasElementKey(element))
    {
        console.log("line", line);
        return sarosToRegularText(line).replace('\n', '').indexOf(element["type"]);
    }
    return 0;
}

//-------------------------------------------------------------------------------
// Returns the offset of where a element's name begins
//-------------------------------------------------------------------------------
function getSpoofaxNameOffset(element, line)
{
    if (hasElementKey(element))
    {
        var typeOffset = sarosToRegularText(line).replace('\n', '').indexOf(element["type"]);
        var typeLength = element["type"].length;
        return typeOffset + typeLength + 1;
    }
}

//-------------------------------------------------------------------------------
// Returns true if the element type displays its key
//-------------------------------------------------------------------------------
function hasElementKey(element)
{
    switch (element["type"]) 
    {
        case "root":
        case "parent":
        case "child":
            return true;
    
        default:
            return false;
    }
}

//-------------------------------------------------------------------------------
// Make the functions available
//-------------------------------------------------------------------------------
module.exports = {
    findInTree, 
    findInternalNode,
    findPathToNode,
    updateInternalNode,
    bitCount, 
    logicalToPhysicalIndex,
    isBitNotSet,
    put,
    getInternalNodeHash,
    getInternalNodeString,
    upVersion,
    hash,
    getTime,
    upLong,
    compareLong,
    regularToSarosText,
    sarosToMpsText,
    sarosToRegularText,
    getSpoofaxNewLineIndex,
    putSpoofaxLine,
    getSpoofaxLine,
    getMpsNodeProperties,
    getMpsEditOffset,
    generateSpoofaxDslLine,
    getSpoofaxNameOffset,
    hasElementKey
}