module.exports = function(RED) {
    "use strict";
    var http = require("follow-redirects").http;
    var https = require("follow-redirects").https;
    var urllib = require("url");
    var express = require("express");
    var getBody = require('raw-body');
    var jsonParser = express.json();
    var urlencParser = express.urlencoded();
    var SoxClient = require('./lib/sox/SoxClient.js');
    var SoxEventListener = require('./lib/sox/SoxEventListener.js')
    var Device = require('./lib/sox/Device.js')
    var SensorData = require('./lib/sox/SensorData.js');
    var Transducer = require('./lib/sox/Transducer.js');

    /*
    * Node for Sox Input
    */
    function SoxDataIn(n) {
      RED.nodes.createNode(this,n);
      var node = this;

      if (!n.device){
        node.error("No device specified");
        return;
      }

      this.login = RED.nodes.getNode(n.login);// Retrieve the config node
      if (!this.login) {
          node.error("No credentials specified");
          return;
      }

      this.device = n.device;
      //this.url = this.login.url || "http://wotkit.sensetecnic.com";

      this.bosh = this.login.bosh || "http://sox.ht.sfc.keio.ac.jp:5280/http-bind/";
      this.xmpp = this.login.xmpp || "sox.ht.sfc.keio.ac.jp";
      this.jid = this.login.jid;// || "sensorizer@sox.ht.sfc.keio.ac.jp";
      this.password = this.login.password;// || "miromiro";
      //var sensorName = "hcttest";

      if (this.bosh && this.xmpp && this.jid && this.password && this.device) {
        var deviceName = this.device;
        var client = new SoxClient.SoxClient(this.bosh, this.xmpp, this.jid, this.password);

        var soxEventListener = new SoxEventListener.SoxEventListener();
        soxEventListener.connected = function(soxEvent) {
          node.warn("Connected to: "+soxEvent.soxClient);
          console.log(deviceName)
          var device = new Device.Device(deviceName);
          if(!client.subscribeDevice(device)){
            node.warn("Couldn't send subscription request: "+device);
          }
        };
        soxEventListener.connectionFailed = function(soxEvent) {
          node.error("Connection Failed: "+soxEvent.soxClient);
        };
        soxEventListener.subscribed = function(soxEvent){
          node.warn("Subscribed: "+soxEvent.device);
        };
        soxEventListener.subscriptionFailed = function(soxEvent){
          node.error("Subscription Failed: "+soxEvent.device);
        };
        soxEventListener.metaDataReceived = function(soxEvent){
          node.warn("Meta data received: "+soxEvent.device);
        };
        soxEventListener.sensorDataReceived = function(soxEvent){
          if (soxEvent.transducers && soxEvent.transducers.length > 0) {
            node.send( {payload: soxEvent.transducers});
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

         if (!n.device) {
             node.error("No device specified");
             return;
         }

         this.login = RED.nodes.getNode(n.login);// Retrieve the config node
         if (!this.login) {
             node.error("No credentials specified");
             return;
         }
         /*
         this.sensor = n.sensor;
         //this.bosh = this.login.url || "url.com";
         //etc...
         this.on("input",function(msg) {
             if (msg.payload !== undefined) {
                 // Accepted formats: Formated Object.
                 //sendevent
             }
         });
         */
         this.on('close', function(){
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
