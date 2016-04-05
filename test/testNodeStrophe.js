var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = function (data){
    return new MyJquery(data);  
};

var MyJquery = function(data){
    if (typeof data !== 'string')
        this.doc = data.doc || data;
    else 
       this.doc = jsdom(data, {});

    this.length = this.doc.length || this.doc.childNodes.length || this.doc.body.length || this.doc.body.childNodes.length;

    return this;
}

$.fn = MyJquery.prototype = 
{
    attr: function (name) {
        // It's important to return this if you want to chain methods!
        return this.doc.body.childNodes[0].getAttribute(name);
    },
    find: function (query) {
        var selector = this.doc.querySelectorAll(query);
        return new MyJquery(selector[0].outerHTML);
    },
    text: function(){
        var text;

        if (this.doc.body)
            text = this.doc.body.textContent;
        else {
            var childnode0 = this.doc.childNodes[0];
            while (childnode0.hasChildNodes())
                childnode0 = childnode0.childnodes[0];

            text = childnode0.parentNode.innerHTML;
        }
        
        text = text.replace(/\s+</g, "<");
        text = text.replace(/>\s+/g, ">");
        text = text.replace(/\/>/g, "></transducer>");
        //text = text.replace(/transducer/g,'img');// make jsdom happy, it doesn't know about transducer tag!
        return text;
    },
    eq: function(i){
        if (!this.length)
            return "";

        for (var j = 0; j < this.length; j++){
            if (i === j)
                if (this.doc.body.childNodes[i])
                    return this.doc.body.childNodes[i].outerHTML;
                else if (this.doc.body[i])
                    return this.doc.body[i].outerHTML;
                else if (this.doc[i])
                    return this.doc[i].outerHTML;
        }
    }
};




var testString = '<body xmlns=\'http://jabber.org/protocol/httpbind\'><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/9719511701413823240149044\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority><delay xmlns=\'urn:xmpp:delay\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/9719511701413823240149044\' stamp=\'2014-10-20T16:40:40Z\'/><x xmlns=\'jabber:x:delay\' stamp=\'20141020T16:40:40\'/></presence><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/937465781413816191856773\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority><delay xmlns=\'urn:xmpp:delay\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/937465781413816191856773\' stamp=\'2014-10-20T14:43:12Z\'/><x xmlns=\'jabber:x:delay\' stamp=\'20141020T14:43:12\'/></presence><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/27765683871413823264621828\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority><delay xmlns=\'urn:xmpp:delay\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/27765683871413823264621828\' stamp=\'2014-10-20T16:41:05Z\'/><x xmlns=\'jabber:x:delay\' stamp=\'20141020T16:41:05\'/></presence><presence xmlns=\'jabber:client\' from=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\'><priority>-1</priority></presence><iq xmlns=\'jabber:client\' from=\'pubsub.sox.ht.sfc.keio.ac.jp\' to=\'sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524\' id=\'1:sendIQ\' type=\'result\'><pubsub xmlns=\'http://jabber.org/protocol/pubsub\'><items node=\'しらすの入荷情報湘南_meta\'><item id=\'metaInfo\'><device name=\'しらすの入荷情報湘南\' type=\'outdoor weather\'>&lt;transducer name=&apos;url&apos; id=&apos;url&apos; /&gt;		&lt;transducer name=&apos;入荷情報&apos; id=&apos;入荷情報&apos; /&gt;		&lt;transducer name=&apos;latitude&apos; id=&apos;latitude&apos; /&gt;		&lt;transducer name=&apos;longitude&apos; id=&apos;longitude&apos; /&gt;		&lt;transducer name=&apos;天気&apos; id=&apos;天気&apos; /&gt;		&lt;transducer name=&apos;気温&apos; id=&apos;気温&apos; units=&apos;℃&apos; /&gt;		</device></item></items></pubsub></iq></body>'
var myDoc = jsdom(testString, {parsingMode: "xml"});

var testElement = $(myDoc.documentElement);
var deviceElement = testElement.find('device');
var name = $(deviceElement).attr('name');
var type = $(deviceElement).attr('type');
console.log(name);
console.log(type);

var transducerElements = $(deviceElement.text());
for (var i = 0; i < transducerElements.length; i++) {
    console.log(transducerElements.eq(i));
}


var testString2 = '<body xmlns=\'http://jabber.org/protocol/httpbind\'> <message xmlns=\'jabber:client\' from=\'pubsub.ps.ht.sfc.keio.ac.jp\' to=\'guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983\'> <event xmlns=\'http://jabber.org/protocol/pubsub#event\'> <items node=\'hoge_meta\'/> </event> </message> <iq xmlns=\'jabber:client\' from=\'pubsub.ps.ht.sfc.keio.ac.jp\' to=\'guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983\' id=\'9:pubsub\' type=\'result\'> <pubsub xmlns=\'http://jabber.org/protocol/pubsub\'> <subscription jid=\'guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983\' subscription=\'subscribed\' subid=\'56F1130152627\' node=\'hoge_meta\'/> </pubsub> </iq> </body>';
var myDoc = jsdom(testString2, {parsingMode: "xml"});
var metaSub = $(myDoc.documentElement).find('subscription');
var metaSubId = metaSub.attr('subid');
console.log(metaSubId);

var testString3 =  '<body xmlns=\'http://jabber.org/protocol/httpbind\' ack=\'350058604\'><iq xmlns=\'jabber:client\' type=\'result\' id=\'6372:pubsub\' from=\'pubsub.sox.ht.sfc.keio.ac.jp\' to=\'2a6ed1bc@sox.ht.sfc.keio.ac.jp/2a6ed1bc\'><pubsub xmlns=\'http://jabber.org/protocol/pubsub\'><subscription node=\'＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店_meta\' jid=\'2a6ed1bc@sox.ht.sfc.keio.ac.jp/2a6ed1bc\' subid=\'Gt11GXgSS184l5CU03IpapX0aBWFVg8iCcKkUEKf\' subscription=\'subscribed\'><subscribe-options/></subscription></pubsub></iq><message xmlns=\'jabber:client\' from=\'pubsub.sox.ht.sfc.keio.ac.jp\' to=\'2a6ed1bc@sox.ht.sfc.keio.ac.jp/2a6ed1bc\' id=\'＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店_meta__2a6ed1bc@sox.ht.sfc.keio.ac.jp__xREK4\'><event xmlns=\'http://jabber.org/protocol/pubsub#event\'><items node=\'＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店_meta\'><item id=\'611753bf-c888-42d4-9259-8b912e660bdd325057514\'><device xmlns=\'http://jabber.org/protocol/pubsub\' name=\'＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店\' id=\'＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店\' type=\'occupancy\'>   <transducer name=\'url\' id=\'url\'/>   <transducer name=\'latitude\' id=\'latitude\'/>   <transducer name=\'longitude\' id=\'longitude\'/>   <transducer name=\'店舗名\' id=\'店舗名\'/>   <transducer name=\'ジャンル\' id=\'ジャンル\'/>   <transducer name=\'TEL\' id=\'TEL\'/>   <transducer name=\'交通手段\' id=\'交通手段\'/>   <transducer name=\'営業時間\' id=\'営業時間\'/>   <transducer name=\'定休日\' id=\'定休日\'/>   <transducer name=\'URL\' id=\'URL\'/>   <transducer name=\'WEB受付・待ち状況\' id=\'WEB受付・待ち状況\'/>   <transducer name=\'住所\' id=\'住所\'/></device></item></items></event><delay xmlns=\'urn:xmpp:delay\' stamp=\'2016-03-18T03:36:33.003Z\'/></message></body>';
var myDoc = jsdom(testString2, {parsingMode: "xml"});
var metaSub = $(myDoc.documentElement).find('subscription');
var metaSubId = metaSub.attr('subid');
console.log(metaSubId);
