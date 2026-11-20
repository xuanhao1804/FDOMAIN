var manifest = require("./dist/dns-manifest.json");

var REG_NONE = NewRegistrar("none");
var DSP_CLOUDFLARE = NewDnsProvider("cloudflare");
var CF_PROXY_OFF = { cloudflare_proxy: "off" };

var modifiers = [];

for (var i = 0; i < manifest.unmanaged.length; i++) {
  var rule = manifest.unmanaged[i];
  if (rule.target) {
    modifiers.push(IGNORE(rule.label, rule.types, rule.target));
  } else {
    modifiers.push(IGNORE(rule.label, rule.types));
  }
}

for (var j = 0; j < manifest.records.length; j++) {
  var rec = manifest.records[j];
  if (rec.type === "CNAME") {
    modifiers.push(CNAME(rec.label, rec.value, CF_PROXY_OFF));
  } else if (rec.type === "A") {
    modifiers.push(A(rec.label, rec.value, CF_PROXY_OFF));
  } else if (rec.type === "AAAA") {
    modifiers.push(AAAA(rec.label, rec.value, CF_PROXY_OFF));
  } else if (rec.type === "TXT") {
    modifiers.push(TXT(rec.label, rec.value));
  } else {
    throw new Error("Unsupported DNS record type in manifest: " + rec.type);
  }
}

D(manifest.rootDomain, REG_NONE, DnsProvider(DSP_CLOUDFLARE), modifiers);
