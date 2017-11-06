function getParameterDefinitions() {
  return [
  {name:'a', caption:'Width', type:'range', initial:10, unit:'mm'},
  {name:'b', caption:'Height', type:'range', initial:10, unit:'mm'},
  {name:'c', caption:'Length', type:'range', initial:10, unit:'mm'},
  {name:'r', caption:'Corner Radius', type:'range', initial:1, unit:'mm'},
  ];
}

function main(params){
	if (params.r!=0) {
	 	return CSG.roundedCube({                  // rounded cube
		  center: [0, 0, 0],
		  radius: [params.a/2, params.b/2, params.c/2],
		  roundradius: params.r,
		  resolution: 32,
		});
	} else {
  		return cube({size: [params.a, params.b, params.c], center: true});
	}
 
}
