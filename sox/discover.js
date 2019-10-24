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

    this.bosh = this.login.bosh || DEFAULT_BOSH
    this.xmpp = this.login.xmpp || DEFAULT_XMPP
    this.jid = this.login.jid
    this.password = this.login.password

    var node = this
    node.status({ fill: 'red', shape: 'ring', text: 'disconnected' })

    node.on('input', function() {
      node.client = new SoxConnection(this.bosh, this.xmpp)

      node.client.connect(() => {
        node.status({ fill: 'green', shape: 'dot', text: 'connected' })
        node.client.fetchDevices(function(devices) {
          var devicesArray = []
          for (var i = 0; i < devices.length; i++) {
            devicesArray.push(devices[i].getName())
          }
          console.log(devicesArray)
          node.send({ payload: devicesArray })
          // 接続終了
          node.client.disconnect()
          node.status({ fill: 'red', shape: 'ring', text: 'disconnected' })
        })
      })
    })
  }
  RED.nodes.registerType('Discover', SoxDiscoverNode)
}
