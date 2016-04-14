var { getField, tryDoc } = require("../utils");

module.exports = {
  'array': [readArray, writeArray, sizeOfArray],
  'count': [readCount, writeCount, sizeOfCount],
  'container': [readContainer, writeContainer, sizeOfContainer, readContainerGenerator]
};

function readArray(buffer, offset, {type,count,countType,countTypeArgs}, rootNode) {
  var results = {
    value: [],
    size: 0
  };
  var c;
  if(typeof count === "number")
    c = count;
  else if (typeof count !== "undefined")
    c = getField(count, rootNode);
  else if (typeof countType !== "undefined") {
    var {size,value}=tryDoc(() => this.read(buffer, offset, { type: countType, typeArgs: countTypeArgs }, rootNode),"$count");
    results.size += size;
    offset += size;
    c = value;
  } else // TODO : broken schema, should probably error out.
    c = 0;
  for(var i = 0; i < c; i++) {
    ({size,value}=tryDoc(() => this.read(buffer, offset, type, rootNode), i));
    results.size += size;
    offset += size;
    results.value.push(value);
  }
  return results;
}

function writeArray(value, buffer, offset, {type,count,countType,countTypeArgs}, rootNode) {
  if (typeof count === "undefined" && typeof countType !== "undefined")
    offset= tryDoc(() => this.write(value.length, buffer, offset, { type: countType, typeArgs: countTypeArgs }, rootNode),"$count");
  else if (typeof count === "undefined") { // Broken schema, should probably error out
  }
  return value.reduce((offset,v,index) =>tryDoc(() => this.write(v, buffer, offset, type, rootNode),index),offset);
}

function sizeOfArray(value, {type,count,countType,countTypeArgs}, rootNode) {
  var size = 0;
  if (typeof count === "undefined" &&  typeof countType !== "undefined")
    size=tryDoc(() => this.sizeOf(value.length, { type: countType, typeArgs: countTypeArgs }, rootNode),"$count");

  return value.reduce((size,v,index) =>tryDoc(() => size+this.sizeOf(v, type, rootNode), index),size);
}

function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
}

function readContainerGenerator(typeArgs,proto){
  const requireContext=typeArgs.filter(o => {console.log("test",o.type);return proto[`read${capitalizeFirstLetter(o.type)}`].length==3}).length>0;
  const code=`((proto) =>
      (buffer, offset${requireContext ? `,context`:``}) => {
      var size=0;
      var value2={};
      ${requireContext ? `
      var value={};
      value[".."]=context;
      ` :``}
      var result;
      ${typeArgs.reduce((old, o) =>  old + `
      result = proto.read${capitalizeFirstLetter(o.type)}(buffer, offset + size${requireContext ? `,value`:``});
      ${o.anon
    ? `if(result.value !== undefined)
      Object.keys(result.value).forEach(key => ${requireContext ? `value[key]=` : ``}value2[key] = result[key]);`
    : `${requireContext ? `value['${o.name}'] =` : ``} value2['${o.name}'] = result.value;`
    }
      size += result.size;
      `, "")}
      return {value:value2,size:size};
    });`;
  console.log(code);
  return eval(code)(proto);
}


function readContainer(buffer, offset, typeArgs, context) {
  var results = {
    value: { "..": context },
    size: 0
  };
  typeArgs.forEach(({type,name,anon}) => {
    tryDoc(() => {
      var readResults = this.read(buffer, offset, type, results.value);
      results.size += readResults.size;
      offset += readResults.size;
      if (anon) {
        if(readResults.value !== undefined) Object.keys(readResults.value).forEach(function(key) {
          results.value[key] = readResults.value[key];
        });
      } else
        results.value[name] = readResults.value;
    }, name ? name : "unknown");
  });
  delete results.value[".."];
  return results;
}

function writeContainer(value, buffer, offset, typeArgs, context) {
  value[".."] = context;
  offset=typeArgs.reduce((offset,{type,name,anon}) =>
    tryDoc(() => this.write(anon ? value : value[name], buffer, offset, type, value),name ?  name : "unknown"),offset);
  delete value[".."];
  return offset;
}

function sizeOfContainer(value, typeArgs, context) {
  value[".."] = context;
  var size = typeArgs.reduce((size,{type,name,anon}) =>
    size + tryDoc(() => this.sizeOf(anon ? value : value[name], type, value), name ? name : "unknown"),0);
  delete value[".."];
  return size;
}

function readCount(buffer, offset, {type}, rootNode) {
  return this.read(buffer, offset, type, rootNode);
}

function writeCount(value, buffer, offset, {countFor,type}, rootNode) {
  // Actually gets the required field, and writes its length. Value is unused.
  // TODO : a bit hackityhack.
  return this.write(getField(countFor, rootNode).length, buffer, offset, type, rootNode);
}

function sizeOfCount(value, {countFor,type}, rootNode) {
  // TODO : should I use value or getField().length ?
  return this.sizeOf(getField(countFor, rootNode).length, type, rootNode);
}
