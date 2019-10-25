// TODO: translate comments into English when complete
var DEFAULT_BOSH = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
var DEFAULT_XMPP = 'sox.ht.sfc.keio.ac.jp'
var SoxConnection = require('soxjs2').SoxConnection

module.exports = function(RED) {
  'use strict'
  function SoxDiscoverNode(config) {
    RED.nodes.createNode(this, config)

    this.login = RED.nodes.getNode(config.login)
    if (!this.login) {
      node.error('No credentials specified')
      return
    }
    // set timing of action
    this.action = config.action
    this.filter = config.filter

    this.bosh = this.login.bosh || DEFAULT_BOSH
    this.xmpp = this.login.xmpp || DEFAULT_XMPP
    this.jid = this.login.jid
    this.password = this.login.password

    var node = this

    function getDevices() {
      node.client = new SoxConnection(node.bosh, node.xmpp)
      node.client.connect(() => {
        node.status({ fill: 'green', shape: 'dot', text: 'request...' })
        node.client.fetchDevices(function(devices) {
          var devicesArray = []
          for (var i = 0; i < devices.length; i++) {
            let deviceName = devices[i].getName()
            // check filter
            if (~deviceName.indexOf(node.filter)) {
              // console.log(deviceName)
              devicesArray.push(deviceName)
            }
          }
          node.send({ payload: devicesArray })
          // disconnect
          node.client.disconnect()
          node.status({})
        })
      })
    }

    node.on('input', function() {
      if (node.action === 'wait_input') {
        getDevices()
      }
    })

    if (node.action === 'deploy') {
      getDevices()
    }

    node.on('close', function() {
      node.client.disconnect()
      node.status({})
    })
  }
  RED.nodes.registerType('Discover', SoxDiscoverNode)
}
