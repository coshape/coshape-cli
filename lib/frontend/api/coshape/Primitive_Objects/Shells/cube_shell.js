function getParameterDefinitions() {
  return [
  {name:'a', caption:'Width', type:'range', initial:10, unit:'mm'},
  {name:'b', caption:'Height', type:'range', initial:10, unit:'mm'},
  {name:'c', caption:'Length', type:'range', initial:10, unit:'mm'},
  {name:'s', caption:'Shell', type:'range', initial:1, unit:'mm'},
  ];
}

function main(params){
	if (params.s != 0) {
		return difference(
			cube({size: [params.a, params.b, params.c], center: true}),
			cube({size: [params.a-params.s, params.b-params.s, params.c+params.s], center: true})
			);

	} else {
		return cube({size: [params.a, params.b, params.c], center: true});
	}
}
