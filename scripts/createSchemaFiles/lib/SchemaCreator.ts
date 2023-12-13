import {
  translateDrizzleObjectName, translateEnumConstName,
  translateEnumName,
  translateFileName,
  translateSQLTableName,
  translateTypeName,
} from './translateNames'
import { DBMLEnum, DBMLField, DBMLSchema, DBMLTable } from './types'
import {
  createConfigForType,
  getEnumValueDefinitions,
  translateImportType,
  translateImportTypes,
  getDefault,
  parseEnums, isEnum,
} from './translateTypes'
import { uniqueArray } from './tools.array'
import { getReferences } from './references'
import { createIndexEntry, getUsedTypesFromIndexes } from './indexes'
import { ENUM_DIR_NAME } from '../consts'

export class SchemaCreator {
  schema: DBMLSchema

  constructor(schema: DBMLSchema) {
    this.schema = schema

    parseEnums(schema)
  }

  createFieldEntry(tableName: string, field: DBMLField) {
    const config = createConfigForType(field.type.type_name)

    let line = `${field.name}: `
    line+=`${translateImportType(field.type.type_name)}('${field.name}'${config})`
    if (field.pk === true) line += '.primaryKey()'
    if (field.unique === true) line += '.unique()'
    if (field.not_null === undefined || field.not_null === true) line += '.notNull()'
    if (field.dbdefault !== undefined) line += getDefault(field.dbdefault)
    line += getReferences(this.schema, tableName, field.name)

    return line
  }

  getTableImports(tableName: string) {
    const imports: string[] = []

    this.schema.refs.forEach(ref => {
      const endpoints = ref.endpoints
      if (endpoints[1].tableName === tableName && (endpoints[1].relation === '1' || endpoints[1].relation === '*')) {
        imports.push(endpoints[0].tableName)
      }
    })

    return imports
  }

  getEnumImports(table: DBMLTable) {
    const imports: string[] = []

    table.fields.forEach(field => {
      if (isEnum(field.type.type_name)) {
        imports.push(field.type.type_name)
      }
    })

    return imports
  }


  getFields(table: DBMLTable) {
    return table.fields.map(field => field.type.type_name)
  }

  createImportSection(table: DBMLTable) {
    const fields = this.getFields(table)
    const indexes = table.indexes
    const tableImports = this.getTableImports(table.name)
    const enumImports = this.getEnumImports(table)

    let fileData = ''

    let usedTypes = getUsedTypesFromIndexes(indexes)
    usedTypes = usedTypes.concat(translateImportTypes(fields))
    usedTypes = uniqueArray(usedTypes)
    usedTypes.unshift('mysqlTable')

    fileData += `import { ${usedTypes.join(', ')} } from 'drizzle-orm/mysql-core'\n`
    tableImports.forEach(table => {
      fileData += `import { ${translateDrizzleObjectName(table)} } from './${translateFileName(table)}'\n`
    })
    enumImports.forEach(enumName => {
      fileData += `import { ${translateEnumConstName(enumName)} } from './${ENUM_DIR_NAME}/${translateFileName(enumName)}'\n`
    })

    fileData+= '\n'

    return fileData
  }

  createEnumEntry(enumType: string) {
    let fileData = ''

    fileData += `export const ${translateEnumConstName(enumType)} = [\n`
    getEnumValueDefinitions(enumType).forEach(enumValueDef => {
      fileData += `  '${enumValueDef.name}',${enumValueDef.note ? ` // Note: ${enumValueDef.note}`: ''}\n`
    })
    fileData += '] as const\n'
    fileData += '\n'
    fileData += `export const ${translateEnumName(enumType)} = z.enum(${translateEnumConstName(enumType)})\n`
    fileData += '\n'
    fileData += `export type ${translateEnumName(enumType)} = z.infer<typeof ${translateEnumName(enumType)}>\n`

    return fileData
  }

  createFieldsSection(table:DBMLTable) {
    const drizzleName = translateDrizzleObjectName(table.name)
    const tableName = translateSQLTableName(table.name)

    let fileData = ''

    fileData += `export const ${drizzleName} = mysqlTable('${tableName}', {\n`
    table.fields.forEach(field => {
      fileData += `  ${this.createFieldEntry(table.name, field)},${field.note ? ` // Note: ${field.note}` : ''}\n`
    })

    return fileData
  }

  createIndexesSection(table: DBMLTable) {
    let fileData = ''

    const indexes = table.indexes

    if (indexes.length <= 0) {
      fileData += '})\n'
    } else {
      fileData += '}, (table) => {\n'
      fileData += '  return {\n'
      indexes.forEach(index => {
        fileData += `    ${createIndexEntry(index)},${index.note ? ` // Note: ${index.note}` : ''}\n`
      })
      fileData += '  }\n'
      fileData += '})\n'
    }
    fileData+= '\n'

    return fileData
  }

  createExportTypeSection(table: DBMLTable) {
    const drizzleName = translateDrizzleObjectName(table.name)
    const typeName = translateTypeName(table.name)

    return `export type ${typeName} = typeof ${drizzleName}.$inferSelect\n`
  }

  public createTableFileData(table: DBMLTable) {

    let fileData = ''

    fileData += this.createImportSection(table)
    fileData += this.createFieldsSection(table)
    fileData += this.createIndexesSection(table)
    fileData += this.createExportTypeSection(table)

    return fileData
  }

  public createEnumFileData(enumData: DBMLEnum) {
    let fileData = ''

    fileData += 'import z from \'zod\'\n'
    fileData += '\n'
    fileData += this.createEnumEntry(enumData.name)

    return fileData
  }
}
