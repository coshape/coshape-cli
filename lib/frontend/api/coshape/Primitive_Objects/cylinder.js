function getParameterDefinitions() {
  return [{name:'a', caption:'Radius', type:'range', initial:10, unit:'mm'},
    {name:'b', caption:'Height', type:'range', initial:10, unit:'mm'},
    ];
}

function main(params){
	return cylinder({r: params.a, h: params.b});
}
