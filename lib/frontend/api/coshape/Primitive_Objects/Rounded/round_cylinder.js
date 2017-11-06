function getParameterDefinitions() {
  return [{name:'a', caption:'Radius', type:'range', initial:10, unit:'mm'},
    {name:'b', caption:'Height', type:'range', initial:10, unit:'mm'},
    ];
}

function main(params){
	//return cylinder({r: params.a, h: params.b, round: true});
	return CSG.roundedCylinder({               // and its rounded version
	  start: [0, -params.b/2, 0],
	  end: [0, params.b/2, 0],
	  radius: params.a,
	  resolution: 32
	});
}
