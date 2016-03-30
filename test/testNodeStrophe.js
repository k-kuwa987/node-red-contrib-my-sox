var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = function (data){
	var elem = jsdom(data, {}).body;
	var firstChild = elem.firstChild;

	return {
		attr: function(name){
			return firstChild.getAttribute(name);
		},
		find: function(query){
			var result = firstChild.querySelector(query);
			return $(result.outerHTML);
		}	
	};
};

var testString = '<body xmlns=\'http://jabber.org/protocol/httpbind\'><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/9719511701413823240149044\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority><delay xmlns=\'urn:xmpp:delay\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/9719511701413823240149044\' stamp=\'2014-10-20T16:40:40Z\'/><x xmlns=\'jabber:x:delay\' stamp=\'20141020T16:40:40\'/></presence><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/937465781413816191856773\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority><delay xmlns=\'urn:xmpp:delay\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/937465781413816191856773\' stamp=\'2014-10-20T14:43:12Z\'/><x xmlns=\'jabber:x:delay\' stamp=\'20141020T14:43:12\'/></presence><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/27765683871413823264621828\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority><delay xmlns=\'urn:xmpp:delay\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/27765683871413823264621828\' stamp=\'2014-10-20T16:41:05Z\'/><x xmlns=\'jabber:x:delay\' stamp=\'20141020T16:41:05\'/></presence><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority></presence><iq xmlns=\'jabber:client\' from=\'pubsub.sox.ht.sfc.keio.ac.jp\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\' id=\'1:sendIQ\' type=\'result\'><pubsub xmlns=\'http://jabber.org/protocol/pubsub\'><items node=\'しらすの入荷情報湘南_meta\'><item id=\'metaInfo\'><device name=\'しらすの入荷情報湘南\' type=\'outdoor weather\'>&lt;transducer name=&apos;url&apos; id=&apos;url&apos; /&gt;		&lt;transducer name=&apos;入荷情報&apos; id=&apos;入荷情報&apos; /&gt;		&lt;transducer name=&apos;latitude&apos; id=&apos;latitude&apos; /&gt;		&lt;transducer name=&apos;longitude&apos; id=&apos;longitude&apos; /&gt;		&lt;transducer name=&apos;天気&apos; id=&apos;天気&apos; /&gt;		&lt;transducer name=&apos;気温&apos; id=&apos;気温&apos; units=&apos;℃&apos; /&gt;		</device></item></items></pubsub></iq></body>'
var deviceElement = $(testString).find('device');
var name = $(deviceElement).attr('name');
var type = $(deviceElement).attr('type');
console.log(name);
console.log(type);