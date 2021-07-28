var socket = io();

socket.on('mps-data', function(data) 
{
    //console.log("MPS data: " + data);
    //console.log(data.length);

    if (data == '<pre><span class=json-string>""</span></pre>')
    {
        data = 'No MPS project data';
    }

    document.getElementById('mps-data').innerHTML = data;
});

socket.on('parsafix-data', function(data) 
{
    //console.log("Parsafix data: " + data);
    //console.log(data.length);

    if (data == '<pre><span class=json-string>""</span></pre>')
    {
        data = 'No Parsafix data';
    }

    document.getElementById('parsafix-data').innerHTML = data;
});

socket.on('spoofax-data', function(data) 
{
    //console.log("Spoofax data: " + JSON.stringify(data));

    var htmlOutput = '';

    if (data != "" && data != null)
    {
        for (const key in data)
        {
            var decodedString = JSON.stringify(data[key]).replaceAll('%0A', '%0A<br>');
            decodedString = decodedString.substr(1, decodedString.length - 2);
            htmlOutput += '<div class="file-name">' + decodeURIComponent(key) + '</div><div class="spoofax-file">' + decodedString + '</div><br><br>';
        } 
    }
    else
    {
        htmlOutput = 'No Spoofax project data';
    }

    document.getElementById('spoofax-data').innerHTML = htmlOutput;
});