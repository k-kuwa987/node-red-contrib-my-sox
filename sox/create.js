// TODO: translate comments into English when complete
var DEFAULT_BOSH = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
var DEFAULT_XMPP = 'sox.ht.sfc.keio.ac.jp'
var SoxConnection = require('soxjs2').SoxConnection
var Device = require('soxjs2').Device
var DeviceMeta = require('soxjs2').DeviceMeta
var MetaTransducer = require('soxjs2').MetaTransducer

module.exports = function(RED) {
  'use strict'
  function SoxCreateNode(config) {
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

    node.on('input', function(msg) {
      console.log('------------------')
      console.log(msg.device)
      node.client = new SoxConnection(node.bosh, node.xmpp)

      node.client.connect(() => {
        console.log('connect!')
        node.status({ fill: 'green', shape: 'dot', text: 'connected' })

        var domain = node.client.getDomain()
        var device = new Device(node.client, msg.device.device_name, domain)
        var hogeTransducer = new MetaTransducer(device, 'hoge', 'hoge')
        var metaTransducers = [hogeTransducer]
        var serialNumber = '1'

        var deviceMeta = new DeviceMeta(
          device,
          msg.device.device_name,
          msg.device.device_type,
          serialNumber,
          metaTransducers
        )

        var suc = function() {
          console.log('create success')
          node.send({ payload: 'Success' })
          node.status({})
        }

        var err = function() {
          console.log('create error')
          node.send({ payload: 'Error' })
          node.status({ fill: 'red', shape: 'dot', text: 'error' })
        }

        // console.log('===================')
        // console.log(device)
        // console.log(deviceMeta)

        node.client.createDevice(device, deivceMeta, suc, err)
        console.log('@@@@ create_device!! -----------------------')
      })
    })

    node.on('close', function() {
      node.client.disconnect()
      node.status({})
    })
  }
  RED.nodes.registerType('Create', SoxCreateNode)
}
