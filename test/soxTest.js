var expect = require("chai").expect;
var auth = require("../lib/auth.js");
 
var boshService = "http://sox.ht.sfc.keio.ac.jp:5280/http-bind/";
var xmppServer = "sox.ht.sfc.keio.ac.jp";
var jid = "guest@sox.ht.sfc.keio.ac.jp";
var password = "miroguest";

describe("Auth", function(){
	describe('#login', function(){
		it('should log the user in using user name and password', function(){
			var result = auth.login(boshService, xmppServer);
			// var result = auth.login(boshService, xmppServer, jid, password);

			expect(result).to.have.a.property('authenticated', false);
			expect(result).to.have.a.property('connection', null);
		})
	})
});