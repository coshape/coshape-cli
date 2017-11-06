// composite for scriptable modeling items

var XMOD = XMOD || {};

XMOD.CItem = function(name, code) {
	this.name = name;
	this.code = code;	
}

XMOD.CItem.prototype.Code = function() {
	return this.code;
}

var myitem = new XMOD.CItem();


