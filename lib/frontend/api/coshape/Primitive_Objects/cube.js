function getParameterDefinitions() {
  return [
  {name:'a', caption:'Width', type:'range', initial:10, unit:'mm'},
  {name:'b', caption:'Height', type:'range', initial:10, unit:'mm'},
  {name:'c', caption:'Length', type:'range', initial:10, unit:'mm'},
  ];
}

function main(params){
  	return cube({size: [params.a, params.b, params.c], center: true});
}
