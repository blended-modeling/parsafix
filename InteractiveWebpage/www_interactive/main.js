var socket = io();

//-------------------------------------------------------------------------------
// Upon recieving MPS data
//-------------------------------------------------------------------------------
socket.on('mps-data', function(data, mpsData) 
{
    document.getElementById('mps-data').innerHTML = data;

    var currentId = "-1";
    var currentConcept = "model";
    $("#mps-data pre span").each(function(index)
    {
        if ($(this).attr('class') == "json-key")
        {
            //Get the current element ID and concept
            if ($(this).html() == "id")
            {
                currentId = JSON.stringify($(this).next().next().html()).replaceAll('"', '').replaceAll('\\', '');   
            }
            if ($(this).html() == "concept")
            {
                currentConcept = JSON.stringify($(this).next().next().html()).replaceAll('"', '').replaceAll('\\', '');
            }

            //Add child buttons
            if ($(this).html() == "children" && !(currentId == "0" && mpsData.hasOwnProperty("children") && mpsData["children"].length > 0))
            {
                if (currentConcept != "GenericDSL.structure.Child")
                {
                    $(this).append('<button id="' + currentId + '">Add</button>');

                    $('#' + currentId).click(function()
                    {
                        socket.emit("add-child", currentId);
                    });
                }
            }

            //Delete element buttons
            if ($(this).html() == "id" && currentId != "0")
            {
                $(this).append('<button id="del-' + currentId + '">Delete</button>');

                $('#del-' + currentId).click(function()
                {
                    socket.emit("del-element", currentId);
                });
            }

            //Name input fields
            if ($(this).html() == "properties" && currentId != "0")
            {
                var valEl = $(this).next().next().next();
                var $input = $('<input/>');
                var props = valEl.html().replaceAll('"', '').replaceAll('\\', '');
                var name = props.split('=')[1];

                $input.val(name);
                $(valEl).replaceWith($input)

                $($input).keyup(function(e)
                {
                    var code = e.keyCode || e.which;
                    //Enter
                    if(code == 13)
                    {
                        e.preventDefault();
                    }
                    //Space
                    else if(code == 32)
                    {
                        e.preventDefault();
                        $($input).val($($input).val().slice(0, -1) + '+');
                    }

                    socket.emit("edit", currentId, $($input).val());
                });
            }
        }
    });
});

//-------------------------------------------------------------------------------
// Upon receiving Parsafix daata
//-------------------------------------------------------------------------------
socket.on('parsafix-data', function(data) 
{
    if (data == '<pre><span class=json-string>""</span></pre>')
    {
        data = 'No Parsafix data';
    }

    document.getElementById('parsafix-data').innerHTML = data;
});

//-------------------------------------------------------------------------------
// Upon receiving Spoofax data
//-------------------------------------------------------------------------------
socket.on('spoofax-data', function(data)
{
    if (data["model_0.dsl"] != null)
    {
        var text = JSON.stringify(data["model_0.dsl"]);
        var parsedText = JSON.parse(text);
        document.getElementById('spoofax-data').value = parsedText.replaceAll('%0A', '%0A\n');
    }
});

//-------------------------------------------------------------------------------
// Handle special keys in the Spoofax text
//-------------------------------------------------------------------------------
$("#spoofax-data").keypress(function(e)
{
    var code = e.keyCode || e.which;
    //Enter
    if(code == 13)
    {
        e.preventDefault();
        $("#spoofax-data").val($("#spoofax-data").val() + '%0A\n');
    }
    //Space
    else if(code == 32)
    {
        e.preventDefault();
        $("#spoofax-data").val($("#spoofax-data").val() + '+');
    }
    //Backspace/delete
    else if(code == 8 || code == 46)
    {
        
    }
});

//-------------------------------------------------------------------------------
// Send Spoofax data to the parser when a key is released
//-------------------------------------------------------------------------------
$("#spoofax-data").keyup(function(e)
{
    //Ignore arrow keys
    var code = e.keyCode || e.which;
    if(code == 37 || code == 38 || code == 39 || code == 40)
    {
        return;
    }

    var spoofaxText = $("#spoofax-data").val();

    var lineArr = spoofaxText.split('\n');
    var charIndex = document.getElementById("spoofax-data").selectionStart;
    var textLength = 0;
    var lineIndex = -1;
    for (let i = 0; i < lineArr.length; i++) 
    {
        textLength += lineArr[i].length + 1;
        if(charIndex < textLength)
        {
            lineIndex = i;
            break;
        }
    }
    
    var op = {
        "$":{
            "sl":lineIndex,
            "so":0
        }
    };

    socket.emit('spoofax-edit', {"model_0.dsl":spoofaxText.replaceAll('\n', '')}, 'insertOp', op, "model_0.dsl");
    socket.emit('spoofax-data', {"model_0.dsl":spoofaxText.replaceAll('\n', '')});
});