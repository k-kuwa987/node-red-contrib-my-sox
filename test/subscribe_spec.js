var should = require('should')
var helper = require('node-red-node-test-helper')
var subscribeNode = require('../sox/subscribe')

helper.init(require.resolve('node-red'))

describe('Subscribe Node', function() {
  beforeEach(function(done) {
    helper.startServer(done)
  })

  afterEach(function(done) {
    helper.unload()
    helper.stopServer(done)
  })

  it('should be loaded', function(done) {
    var flow = [{ id: 'n1', type: 'Subscribe', name: 'Subscribe Device' }]
    helper.load(subscribeNode, flow, function() {
      var n1 = helper.getNode('n1')
      n1.should.have.property('name', 'Subscribe Device')
      done()
    })
  })
})
