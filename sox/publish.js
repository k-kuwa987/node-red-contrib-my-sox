// TODO: translate comments into English when complete
var DEFAULT_BOSH = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
var DEFAULT_XMPP = 'sox.ht.sfc.keio.ac.jp'
var SoxConnection = require('soxjs2').SoxConnection

module.exports = function(RED) {
  'use strict'
  function SoxPublishNode(config) {
    RED.nodes.createNode(this, config)

    this.login = RED.nodes.getNode(config.login)
    if (!this.login) {
      node.error('No credentials specified')
      return
    }

    this.device = config.device

    this.bosh = this.login.bosh || DEFAULT_BOSH
    this.xmpp = this.login.xmpp || DEFAULT_XMPP
    this.jid = this.login.jid
    this.password = this.login.password

    var node = this

    node.on('input', function() {
      // fixme
    })

    node.on('close', function() {
      node.client.disconnect()
      node.status({})
    })
  }
  RED.nodes.registerType('Publish', SoxPublishNode)
}
