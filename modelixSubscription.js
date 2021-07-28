const net = require('net');

//-------------------------------------------------------------------------------
// Modelix Subscription class
//-------------------------------------------------------------------------------
class ModelixSubscription 
{
    client;
    classEmitter;

    constructor(emitter)
    {
        this.client = new net.Socket();
        this.classEmitter = emitter;
    }

    //-------------------------------------------------------------------------------
    // Returns a HTTP subscription request with the given key
    //-------------------------------------------------------------------------------
    httpSubscriptionRequest(key)
    {
        var httpString = 'GET /subscribe/' + key + ' HTTP/1.1\r\n' +
        'Host: localhost:28101\r\n' +
        'Connection: keep-alive\r\n' +
        'Authorization: Bearer null\r\n' +
        'User-Agent: Jersey/2.31 (HttpUrlConnection 11.0.6)\r\n' +
        'Accept: text/event-stream\r\n' + 
        '\r\n';

        console.log("\nSubscribing to: '" + key + "'");
        return httpString;
    }

    //-------------------------------------------------------------------------------
    // Subscribe to the given Modelix branch
    //-------------------------------------------------------------------------------
    subscribe(branch)
    {
        //-------------------------------------------------------------------------------
        // When we've connected to the model server
        //-------------------------------------------------------------------------------
        this.client.connect(28101, "localhost", function() 
        {
            console.log("\nSubscription connection to model server successful.");

            //Subscribe
            this.client.write(this.httpSubscriptionRequest(branch));
        }.bind(this));

        //-------------------------------------------------------------------------------
        // When the connection to the model server is closed
        //-------------------------------------------------------------------------------
        this.client.on("close", function() {
            console.log("\nSubscription connection to model server closed.");
        });

        //-------------------------------------------------------------------------------
        // When we receive data from the model server
        //-------------------------------------------------------------------------------
        this.client.on("data", function(data) 
        {
            //Handle the incoming data
            this.classEmitter.emit('data', data);
        }.bind(this));
    }


    //-------------------------------------------------------------------------------
    // Closes the subscription connection
    //-------------------------------------------------------------------------------
    stop()
    {
        try 
        {
            this.client.destroy();
        } 
        catch (error) {}    
    }
}

//-------------------------------------------------------------------------------
// Make the class available
//-------------------------------------------------------------------------------
module.exports = {
    ModelixSubscription
}