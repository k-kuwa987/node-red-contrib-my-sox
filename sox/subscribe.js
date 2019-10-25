// TODO: translate comments into English when complete
var DEFAULT_BOSH = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
var DEFAULT_XMPP = 'sox.ht.sfc.keio.ac.jp'
var SoxConnection = require('soxjs2').SoxConnection

// not used
// var soxConfig = {  // FIXME
//   boshService: DEFAULT_BOSH,
//   jid: "",
//   password: ""
// };

module.exports = function(RED) {
  'use strict'
  function SoxSubscribeNode(config) {
    RED.nodes.createNode(this, config)

    if (!config.device) {
      this.error('No device specified')
      return
    }

    this.login = RED.nodes.getNode(config.login) // Retrieve the config node
    if (!this.login) {
      node.error('No credentials specified')
      return
    }

    this.devices = config.device.replace(/\s/g, '').split(',')
    this.transducer = config.transducer

    this.bosh = this.login.bosh || DEFAULT_BOSH
    this.xmpp = this.login.xmpp || DEFAULT_XMPP
    this.jid = this.login.jid
    this.password = this.login.password

    var node = this

    var soxEventListener = function(data) {
      console.log('@@@@ sub data retrieved')
      console.log(data)

      var deviceName = data.getDevice().getName()
      var values = data.getTransducerValues()
      var deviceMatch = false
      // console.log('-------- Sensor data received from ' + soxEvent.device.name)
      for (var i = 0; i < node.devices.length; i++) {
        if (node.devices[i] === deviceName) {
          deviceMatch = true
          break
        }
      }
      if (!deviceMatch) {
        return
      }
      console.log('device matched')

      if (values.length === 0) {
        return
      }
      console.log('values presented')

      if (!node.transducer) {
        node.send({ payload: values, topic: deviceName })
        return
      }
      console.log('node transducer presented')

      for (var i = 0; i < values.length; i++) {
        // console.log(values[i].getTransducerId())
        // console.log(node.transducer)
        if (values[i].getTransducerId() === node.transducer) {
          // console.log(values[i].getRawValue())
          // data output
          node.send({
            payload: ':' + values[i].getRawValue(),
            topic: deviceName
          })
          break
        }
      }
    }

    // *** user login
    // var conn = new SoxConnection(soxConfig.boshService, soxConfig.jid, soxConfig.password);

    // *** anonymous login (jid=null does not work!)
    // TODO: authenticated not work now, ignoring jid and password
    this.client = new SoxConnection(this.bosh, this.xmpp)
    // this.client.unsubscribeAll();

    // node.client.setSoxEventListener(soxEventListener);
    node.client.connect(() => {
      node.status({ fill: 'green', shape: 'dot', text: 'connected' })

      node.devices.forEach(function(deviceName) {
        var device = node.client.bind(deviceName)
        node.client.addListener(device, soxEventListener)
        node.client.subscribe(device)
      })
    })

    // if this node is deleted
    node.on('close', function() {
      // node.client.setSoxEventListener(null);
      node.client.unsubscribeAll()
      node.client.disconnect()
      node.status({})
    })
  }
  RED.nodes.registerType('Subscribe', SoxSubscribeNode)
}
