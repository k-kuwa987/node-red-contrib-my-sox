module.exports = function(RED) {
    "use strict";
    var SoxClient = require('./lib/sox/SoxClient.js');
    var SoxEventListener = require('./lib/sox/SoxEventListener.js')
    var Device = require('./lib/sox/Device.js')
    var SensorData = require('./lib/sox/SensorData.js');
    var Transducer = require('./lib/sox/Transducer.js');

    /*
    * Node for Sox Input
    */
    //TODO: must specify transducer to listen to
    function SoxDataIn(n) {
      RED.nodes.createNode(this,n);
      var node = this;

      if (!n.device){
        node.error("No device specified");
        return;
      }

      if (!n.transducer){
        node.error("No transducer specified");
        return;
      }

      this.login = RED.nodes.getNode(n.login);// Retrieve the config node
      if (!this.login) {
          node.error("No credentials specified");
          return;
      }

      this.device = n.device;
      this.transducer = n.transducer;

      this.bosh = this.login.bosh || "http://sox.ht.sfc.keio.ac.jp:5280/http-bind/";
      this.xmpp = this.login.xmpp || "sox.ht.sfc.keio.ac.jp";
      this.jid = this.login.jid;
      this.password = this.login.password;

      if (this.bosh && this.xmpp && this.jid && this.password && this.device) {
        var deviceName = this.device;
        var transducerName = this.transducer;
        var client = new SoxClient.SoxClient(this.bosh, this.xmpp, this.jid, this.password);

        var soxEventListener = new SoxEventListener.SoxEventListener();
        soxEventListener.connected = function(soxEvent) {
          //node.warn("Connected to: "+soxEvent.soxClient);
          node.status({fill:"green",shape:"dot",text:"OK"});
          var device = new Device.Device(deviceName);
          var transducer = new Transducer.Transducer();//create a transducer
          transducer.name = transducerName;
          transducer.id = transducerName;
          device.addTransducer(transducer);//add the transducer to the device

          if(!client.subscribeDevice(device)){
            node.warn("Couldn't send subscription request: "+device);
          }
        };
        soxEventListener.connectionFailed = function(soxEvent) {
          node.error("Connection Failed: "+soxEvent.soxClient);
        };
        soxEventListener.subscribed = function(soxEvent){
          //node.warn("Subscribed: "+soxEvent.device);
        };
        soxEventListener.subscriptionFailed = function(soxEvent){
          node.error("Subscription Failed: "+soxEvent.device);
        };
        soxEventListener.metaDataReceived = function(soxEvent){
          node.warn("Meta data received: "+soxEvent.device);
        };
        soxEventListener.sensorDataReceived = function(soxEvent){
          if (soxEvent.transducers && soxEvent.transducers.length > 0) {
            for (var i=0; i< soxEvent.transducers.length; i++) {
              node.send( {payload: soxEvent.transducers[i]});
            }
          }
        };

        client.setSoxEventListener(soxEventListener);
        client.connect();

        this.on('close', function(){
            //Clear
            client.disconnect();
            node.status({});
        });

      }

    }
    RED.nodes.registerType("sox in",SoxDataIn);

    /*
     * Node for Sox Sensor Output
     */

     function SoxDataOut(n) {
         RED.nodes.createNode(this,n);
         var node = this;

         if (!n.device){
           node.error("No device specified");
           return;
         }

         if (!n.transducer){
           node.error("No transducer specified");
           return;
         }

         this.login = RED.nodes.getNode(n.login);// Retrieve the config node
         if (!this.login) {
             node.error("No credentials specified");
             return;
         }

         this.device = n.device;
         this.transducer = n.transducer;
         //this.url = this.login.url || "http://wotkit.sensetecnic.com";

         this.bosh = this.login.bosh || "http://sox.ht.sfc.keio.ac.jp:5280/http-bind/";
         this.xmpp = this.login.xmpp || "sox.ht.sfc.keio.ac.jp";
         this.jid = this.login.jid;// || "sensorizer@sox.ht.sfc.keio.ac.jp";
         this.password = this.login.password;// || "miromiro";

         if (this.bosh && this.xmpp && this.jid && this.password && this.device) {
           var deviceName = this.device;
           var transducerName = this.transducer;

            var client = new SoxClient.SoxClient(this.bosh, this.xmpp, this.jid, this.password);

          	var soxEventListener = new SoxEventListener.SoxEventListener();
            var sendEvent;
          	soxEventListener.connected = function(soxEvent) {

              /**
          		 * we are successfully connected to the server
          		 */
          		//node.warn("[main.js] Connected "+soxEvent.soxClient);
              node.status({fill:"green",shape:"dot",text:"OK"});

          		var device = new Device.Device(deviceName);//デバイス名に_dataや_metaはつけない
              sendEvent = function(msg) {
                var transducer = new Transducer.Transducer();//create a transducer
          			transducer.name = transducerName; //TODO: from node conf
          			transducer.id = transducerName; //TODO: from node conf
          			device.addTransducer(transducer);//add the transducer to the device
          			var data = new SensorData.SensorData("occupancy", new Date(), msg, msg.payload);//create a value to publish //TODO: grab value from input
          			transducer.setSensorData(data);//set the value to the transducer
          			soxEvent.soxClient.publishDevice(device);//publish
              }

          	};
          	soxEventListener.connectionFailed = function(soxEvent) {
          		node.warn("Connection Failed: "+soxEvent.soxClient);
          	};
          	soxEventListener.resolved = function(soxEvent){
          		//node.warn("Resolved: "+soxEvent.device);
          	};
          	soxEventListener.resolveFailed = function(soxEvent){
          		node.warn("Resolve Failed: "+soxEvent.device);
          	};
          	soxEventListener.published = function(soxEvent){
          		//node.warn("Published: "+soxEvent.device);
          	};
          	soxEventListener.publishFailed = function(soxEvent){
          		node.warn("Publish Failed: "+soxEvent.device+" errorCode="+soxEvent.errorCode+" errorType="+soxEvent.errorType);
          	};
          	client.setSoxEventListener(soxEventListener);
          	client.connect();

            this.on('input', function(msg) {// do something with 'msg'
              if (sendEvent !== undefined) {
                sendEvent(msg);
              }
            });

         }

         this.on('close', function(){
             client.disconnect();
             node.status({});
         });

     }
     RED.nodes.registerType("sox out",SoxDataOut);

    function SoxCredentialsNode(n) {
        RED.nodes.createNode(this,n);
        this.bosh = n.bosh;
        this.xmpp = n.xmpp;
        if (this.credentials) {
            this.jid = this.credentials.jid;
            this.password = this.credentials.password;
        }
    }
    RED.nodes.registerType("sox-credentials", SoxCredentialsNode, {
        credentials: {
            jid: {type:"text"},
            password: {type: "password"}
        }
    });

};
