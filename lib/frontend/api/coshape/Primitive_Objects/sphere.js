function getParameterDefinitions() {
  return [{name:'a', caption:'radius', type:'range', initial:5, unit:'mm'}];
}

function main(params){
  return sphere({r: params.a, center: true});
}
