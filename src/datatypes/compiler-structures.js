module.exports = {
  Read: {
    array: ['parametrizable', (compiler, array) => {
      let code = ''
      if (array.countType) {
        code += 'const { value: count, size: countSize } = ' + compiler.callType(array.countType) + '\n'
      } else if (array.count) {
        code += 'const count = ' + array.count + '\n'
        code += 'const countSize = 0\n'
      } else {
        throw new Error('Array must contain either count or countType')
      }
      code += 'if (count > 0xffffff && !ctx.noArraySizeCheck) throw new Error("array size is abnormally large, not reading: " + count)\n'
      code += 'const data = []\n'
      code += 'let size = countSize\n'
      code += 'for (let i = 0; i < count; i++) {\n'
      code += '  const elem = ' + compiler.callType(array.type, 'offset + size') + '\n'
      code += '  data.push(elem.value)\n'
      code += '  size += elem.size\n'
      code += '}\n'
      code += 'return { value: data, size }'
      return compiler.wrapCode(code)
    }],
    count: ['parametrizable', (compiler, type) => {
      const code = 'return ' + compiler.callType(type.type)
      return compiler.wrapCode(code)
    }],
    container: ['parametrizable', (compiler, values) => {
      values = containerInlining(values)

      let code = ''
      let offsetExpr = 'offset'
      const names = []
      for (const i in values) {
        const { type, name, anon, _shouldBeInlined } = values[i]
        let trueName
        let sizeName
        if (type instanceof Array && type[0] === 'bitfield' && anon) {
          const subnames = []
          for (const { name } of type[1]) {
            const trueName = compiler.getField(name)
            if (name === trueName) {
              names.push(name)
              subnames.push(name)
            } else {
              names.push(`${name}: ${trueName}`)
              subnames.push(`${name}: ${trueName}`)
            }
          }
          trueName = '{' + subnames.join(', ') + '}'
          sizeName = `anon${i}Size`
        } else {
          trueName = compiler.getField(name)
          sizeName = `${trueName}Size`
          if (_shouldBeInlined) names.push('...' + name)
          else if (name === trueName) names.push(name)
          else names.push(`${name}: ${trueName}`)
        }
        code += `let { value: ${trueName}, size: ${sizeName} } = ` + compiler.callType(type, offsetExpr) + '\n'
        offsetExpr += ` + ${sizeName}`
      }
      const sizes = offsetExpr.split(' + ')
      sizes.shift()
      if (sizes.length === 0) sizes.push('0')
      code += 'return { value: { ' + names.join(', ') + ' }, size: ' + sizes.join(' + ') + '}'
      return compiler.wrapCode(code)
    }]
  },

  Write: {
    array: ['parametrizable', (compiler, array) => {
      let code = ''
      if (array.countType) {
        code += 'offset = ' + compiler.callType('value.length', array.countType) + '\n'
      } else if (array.count === null) {
        throw new Error('Array must contain either count or countType')
      }
      code += 'for (let i = 0; i < value.length; i++) {\n'
      code += '  offset = ' + compiler.callType('value[i]', array.type) + '\n'
      code += '}\n'
      code += 'return offset'
      return compiler.wrapCode(code)
    }],
    count: ['parametrizable', (compiler, type) => {
      const code = 'return ' + compiler.callType('value', type.type)
      return compiler.wrapCode(code)
    }],
    container: ['parametrizable', (compiler, values) => {
      values = containerInlining(values)
      let code = ''
      for (const i in values) {
        const { type, name, anon, _shouldBeInlined } = values[i]
        let trueName
        if (type instanceof Array && type[0] === 'bitfield' && anon) {
          const names = []
          for (const { name } of type[1]) {
            const trueName = compiler.getField(name)
            code += `const ${trueName} = value.${name}\n`
            if (name === trueName) names.push(name)
            else names.push(`${name}: ${trueName}`)
          }
          trueName = '{' + names.join(', ') + '}'
        } else {
          trueName = compiler.getField(name)
          if (_shouldBeInlined) code += `let ${name} = value\n`
          else code += `let ${trueName} = value.${name}\n`
        }
        code += 'offset = ' + compiler.callType(trueName, type) + '\n'
      }
      code += 'return offset'
      return compiler.wrapCode(code)
    }]
  },

  SizeOf: {
    array: ['parametrizable', (compiler, array) => {
      let code = ''
      if (array.countType) {
        code += 'let size = ' + compiler.callType('value.length', array.countType) + '\n'
      } else if (array.count) {
        code += 'let size = 0\n'
      } else {
        throw new Error('Array must contain either count or countType')
      }
      if (!isNaN(compiler.callType('value[i]', array.type))) {
        code += 'size += value.length * ' + compiler.callType('value[i]', array.type) + '\n'
      } else {
        code += 'for (let i = 0; i < value.length; i++) {\n'
        code += '  size += ' + compiler.callType('value[i]', array.type) + '\n'
        code += '}\n'
      }
      code += 'return size'
      return compiler.wrapCode(code)
    }],
    count: ['parametrizable', (compiler, type) => {
      const code = 'return ' + compiler.callType('value', type.type)
      return compiler.wrapCode(code)
    }],
    container: ['parametrizable', (compiler, values) => {
      values = containerInlining(values)
      let code = 'let size = 0\n'
      for (const i in values) {
        const { type, name, anon, _shouldBeInlined } = values[i]
        let trueName
        if (type instanceof Array && type[0] === 'bitfield' && anon) {
          const names = []
          for (const { name } of type[1]) {
            const trueName = compiler.getField(name)
            code += `const ${trueName} = value.${name}\n`
            if (name === trueName) names.push(name)
            else names.push(`${name}: ${trueName}`)
          }
          trueName = '{' + names.join(', ') + '}'
        } else {
          trueName = compiler.getField(name)
          if (_shouldBeInlined) code += `let ${name} = value\n`
          else code += `let ${trueName} = value.${name}\n`
        }
        code += 'size += ' + compiler.callType(trueName, type) + '\n'
      }
      code += 'return size'
      return compiler.wrapCode(code)
    }]
  }
}

function uniqueId () {
  return '_' + Math.random().toString(36).substr(2, 9)
}

function containerInlining (values) {
  // Inlining (support only 1 level)
  const newValues = []
  for (const i in values) {
    const { type, anon } = values[i]
    if (anon && !(type instanceof Array && type[0] === 'bitfield')) {
      if (type instanceof Array && type[0] === 'container') {
        for (const j in type[1]) newValues.push(type[1][j])
      } else if (type instanceof Array && type[0] === 'switch') {
        newValues.push({
          name: uniqueId(),
          _shouldBeInlined: true,
          type
        })
      } else {
        throw new Error('Cannot inline anonymous type: ' + type)
      }
    } else {
      newValues.push(values[i])
    }
  }
  return newValues
}
