function getParameterDefinitions() {
  return [{name:'a', caption:'Radius', type:'range', initial:10, unit:'mm'},
    {name:'b', caption:'Height', type:'range', initial:10, unit:'mm'},
    {name:'s', caption:'Shell', type:'range', initial:1, unit:'mm'},
    ];
}

function main(params){
	return difference(cylinder({r: params.a, h: params.b})
		, cylinder({r: params.a-params.s, h: params.b+params.s}));
}
