var DEFAULT_BOSH = "http://nictsox-lv2.ht.sfc.keio.ac.jp:5280/http-bind/";
var DEFAULT_XMPP = "nictsox-lv2.ht.sfc.keio.ac.jp";


var soxConfig = {  // FIXME
    boshService: DEFAULT_BOSH,
    jid: "",
    password: ""
};

module.exports = function(RED) {
    "use strict";
    var soxLib = require('./lib/soxLib.js');

    var SoxClient = soxLib.SoxClient;
    var SoxEventListener = soxLib.SoxEventListener;
    var Device = soxLib.Device;
    var SensorData = soxLib.SensorData;
    var Transducer = soxLib.Transducer;
    
    /*
    * Node for Sox Input
    */
    function SoxDataIn(n) {
      RED.nodes.createNode(this,n);

      if (!n.device){
        this.error("No device specified");
        return;
      }

      this.login = RED.nodes.getNode(n.login);// Retrieve the config node
      if (!this.login) {
          node.error("No credentials specified");
          return;
      }

      this.devices = n.device.replace(/\s/g,"").split(',');
      this.transducer = n.transducer;

      this.bosh = this.login.bosh || DEFAULT_BOSH;
      this.xmpp = this.login.xmpp || DEFAULT_XMPP;
      this.jid = this.login.jid;
      this.password = this.login.password;

      this.client = new SoxClient(this.bosh, this.xmpp, this.jid, this.password);
      this.client.unsubscribeAll();
      
      var node = this;
      var soxEventListener = new SoxEventListener();
      soxEventListener.connected = function(soxEvent) {
        node.status({fill:"green",shape:"dot",text:"OK"});

        node.devices.forEach(function(deviceName){
          var device = new Device(deviceName);
          if(!node.client.subscribeDevice(device)){
            node.warn("Couldn't send subscription request: "+device);
          }
        })
      };
      soxEventListener.disconnected = function(soxEvent) {
        node.status({fill:"red",shape:"dot",text:"Disconnected"});
        node.client.connect();
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
        var deviceMatch = false
        // console.log("-------- Sensor data received from " + soxEvent.device.name)
        for (var i = 0; i < node.devices.length; i++){
          if (node.devices[i] === soxEvent.device.name){
            deviceMatch = true
            break
          }
        }
        if (!deviceMatch){
          return;
        }

        if (soxEvent.transducers.length === 0){
          return;
        }

        if (!node.transducer){
          node.send({payload: soxEvent.transducers, topic: soxEvent.device.name});
          return;
        }
        
        if (soxEvent.transducers && soxEvent.transducers.length > 0) {
          for (var i=0; i< soxEvent.transducers.length; i++) {
            if (soxEvent.transducers[i].id === node.transducer){
              node.send({payload: soxEvent.transducers[i].sensorData, topic: soxEvent.device.nodeName});
              break;
            }
          }
        }
      };

      node.client.setSoxEventListener(soxEventListener);
      node.client.connect();
      
      node.on('close', function(){
          node.client.setSoxEventListener(null);
          node.client.unsubscribeAll();
          node.client.disconnect();
          node.status({});
      });

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

         this.bosh = this.login.bosh || DEFAULT_BOSH;
         this.xmpp = this.login.xmpp || DEFAULT_XMPP;
         this.jid = this.login.jid;// || "sensorizer@sox.ht.sfc.keio.ac.jp";
         this.password = this.login.password;// || "miromiro";

         if (this.bosh && this.xmpp && this.jid && this.password && this.device) {
           var deviceName = this.device;
           var transducerName = this.transducer;

            node.client = new SoxClient(this.bosh, this.xmpp, this.jid, this.password);

          	var soxEventListener = new SoxEventListener();
            var sendEvent;
          	soxEventListener.connected = function(soxEvent) {

              /**
          		 * we are successfully connected to the server
          		 */
          		//node.warn("[main.js] Connected "+soxEvent.soxClient);
              node.status({fill:"green",shape:"dot",text:"OK"});

          		var device = new Device(deviceName);//デバイス名に_dataや_metaはつけない
              sendEvent = function(msg) {
                var transducer = new Transducer();//create a transducer
          			transducer.name = transducerName; //TODO: from node conf
          			transducer.id = transducerName; //TODO: from node conf
          			device.addTransducer(transducer);//add the transducer to the device
          			var data = new SensorData("occupancy", new Date(), msg, msg.payload);//create a value to publish //TODO: grab value from input
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
          	node.client.setSoxEventListener(soxEventListener);
          	node.client.connect();

            this.on('input', function(msg) {// do something with 'msg'
              if (sendEvent !== undefined) {
                sendEvent(msg);
              }
            });

         }

         this.on('close', function(){
             node.client.disconnect();
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
