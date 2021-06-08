const {GetAppAccessRole} = require(doc_root + '/lib/srv/common');
const fs = require('fs');
var XMLWriter = require('xml-writer');
const Excel = require('exceljs');

module.exports.Export = async function Export(req, resp){
    try {
        if(req.method !== 'GET') throw new Error('Нет доступа');        let user_id = null,client = null;
        if(req.tokenPayload != null) user_id = req.tokenPayload.id;        
        else throw config.errors.sessionClose;

        let UserLevel = req.tokenPayload.user_level;
        let UserLinkedOrgID = req.tokenPayload.base_org;

        let Role = await GetAppAccessRole('organizations', user_id, req.tokenPayload.user_apps);
        if (Role != 1 && Role != 2) throw config.errors.forbidden;

        let FieldNames = [];
        FieldNames.push('PRG_LIC_CODE=Лицензия Параграф');
        FieldNames.push('INN=ИНН');
        FieldNames.push('NAME_FULL=Полное наименование');
        FieldNames.push('NAME_SHORT=Сокращенное наименование');
        FieldNames.push('OPF_NAME=Вид организационно-правовой формы');
        FieldNames.push('OPF_ID=Вид организационно-правовой формы ID');
        FieldNames.push('PROP_TYPE_NAME=Форма собственности');
        FieldNames.push('PROP_TYPE_ID=Форма собственности ID');
        FieldNames.push('ORG_TYPE_NAME=Тип');
        FieldNames.push('ORG_TYPE_ID=Тип ID');
        FieldNames.push('IS_BRANCH_TEXT=Филиал');
        FieldNames.push('OGRN=ОГРН');        
        FieldNames.push('KPP=КПП');
        FieldNames.push('REGION_NAME=Субъект РФ');
        FieldNames.push('STATE_NAME=Муниципалитет');
        FieldNames.push('REG_ADDRESS=Адрес регистрации');
        FieldNames.push('POST_ADDRESS=Почтовый адрес');
        FieldNames.push('HEAD_POST=Должность');
        FieldNames.push('HEAD_FIO=ФИО руководителя');
        FieldNames.push('PHONES=Телефоны');
        FieldNames.push('FAXES=Факсы');
        FieldNames.push('CONTACT_EMAIL=Электронная почта');
        FieldNames.push('WEBSITE=Сайт');
        FieldNames.push('ACTUAL_ADDRESS=Фактический адрес');
        FieldNames.push('CREATION_DATE=Дата регистрации');
        FieldNames.push('LIC_DATE=Дата лицензии');
        FieldNames.push('GIA_CODE=Код ГИА');
        FieldNames.push('PPE_CODE=Код ППЭ');        
        FieldName = FieldNames.map(c=> c.split('=')[0].toLowerCase());
        FieldValue = FieldNames.map(c=> `${c.split('=')[1]}`);
        
        let OoodType = '';
        if(req.query.parent !=='' && req.query.parent !== 'undefined'){
            let r = null;
            client = await db.connect()
            try {                
                r = await client.query('select OBJ_NAME from ORGDATA.ORG_TYPES where OBJ_ID = $1',[req.query.parent]);                
            } catch (e) {
                throw new Error(e);
            }finally{
                client.release();
            }
            if(r.rows.length > 0) OoodType = r.rows[0].obj_name;
        }
        else OoodType = 'Все типы';

        // Возвращаем полный список полей
        let r = null;
        let sqlTex = 'select ORG.*';
        sqlTex += ' from ORGDATA.ORGANIZATIONS_VIEW ORG';
        sqlTex += ' where ORG.DATE_DEL is null';

        if(req.query.parent !=='' && req.query.parent !== 'undefined'){
            sqlTex += ` and ORG.ORG_TYPE_ID = '${req.query.parent}'`;
        }

        if(UserLevel > 2){
            throw config.errors.forbidden;
        }else if(UserLevel == 1){
            // Уровень района
            sqlTex += ` and area_id = '${UserLinkedOrgID}'`;
        }else if(UserLevel == 2){
            // Уровень ОО
            sqlTex += ` and obj_id = '${UserLinkedOrgID}'`;
        }
        client = await db.connect()
        try {
            r = await client.query(sqlTex);
            
        } catch (e) {
            throw new Error(e);
        }finally{
            client.release();
        }
        
        // Начинаем выгрузку
        if(req.query.format == 'xml'){
            
            xw = new XMLWriter;
            xw.startDocument('1.0', 'UTF-8');
            xw.startElement('data');            
            if(r.rows.length > 0){
                for(let row of r.rows){
                    xw.startElement('row')
                    let line = [];
                    for(let name in row){
                        if(FieldName.indexOf(name) == -1) continue;
                        else{
                            let i = FieldName.indexOf(name);
                            if(FieldName[i] == name) {
                                xw.startElement('field')
                                xw.writeAttribute('name', FieldName[i]);
                                xw.writeAttribute('description', ' ');
                                xw.writeAttribute('value', row[name]);
                                xw.endElement();
                            } 
                        }
                    }
                    xw.endElement();
                }
            }            
            xw.endDocument();
            resp.attachment('export.xml');            
            return resp.send(xw.toString());

        }else if(req.query.format == 'csv'){
            
            let csv = "";
            let header = []
            for(let J=0; J < r.fields.length; J++){                
                if(FieldName.indexOf(r.fields[J].name) == -1) header.push(`"${r.fields[J].name}"`);
                else{
                    let i = FieldName.indexOf(r.fields[J].name);
                    if(FieldName[i] == r.fields[J].name) header.push(`"${FieldValue[i]}"`);                        
                }                    
            }
            csv += header.join(';') + '\n';
            if(r.rows.length > 0){
                for(let row of r.rows){
                    let line = [];
                    for(let name in row){
                        if(FieldName.indexOf(name) == -1) continue;
                        else{
                            let i = FieldName.indexOf(name);
                            if(FieldName[i] == name) line.push(`"${row[name] || ''}"`); 
                        }

                    }
                    csv +=line.join(';') + '\n';
                }
                
            }
            resp.attachment('export.csv');            
            return resp.send(csv);

        }else if(req.query.format == 'xls'){

            resp.status(200);
            resp.setHeader('Content-disposition', 'attachment; filename=export.xlsx');
            resp.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            var options = {
                stream: resp
            };
            
            var workbook = new Excel.stream.xlsx.WorkbookWriter(options);
            var worksheet = workbook.addWorksheet('Экспорт');
            let columns = [];
            
            for(let J=0; J < r.fields.length; J++){                
                if(FieldName.indexOf(r.fields[J].name) == -1) columns.push({'header': r.fields[J].name, 'key':r.fields[J].name});        
                else{
                    let i = FieldName.indexOf(r.fields[J].name);                    
                    if(FieldName[i] == r.fields[J].name) columns.push({'header': FieldValue[i], 'key':FieldName[i]});      
                }                    
            }

            
            worksheet.columns = columns;
            worksheet.columns.forEach(column => {
                column.width = column.header.length < 12 ? 12 : column.header.length + 5;                
            });
            
            if(r.rows.length > 0){
                for(let row of r.rows){
                    let line = [];
                    for(let name in row){
                        line.push(row[name] || '');
                        // if(FieldName.indexOf(name) == -1) continue;
                        // else{
                        //     let i = FieldName.indexOf(name);                           
                        //     if(FieldName[i] == name) line.push(row[name] || ''); 
                        // }

                    }
                    worksheet.addRow(line);
                }                
            }             
            workbook.commit();
            

        }else{
            // Во всех остальных случаях возвращаем формат HTML
            let header = []
            for(let J=0; J < r.fields.length; J++){
                if(FieldName.indexOf(r.fields[J].name) == -1) continue;
                else{
                    let i = FieldName.indexOf(r.fields[J].name);
                    if(FieldName[i] == r.fields[J].name) header.push(FieldValue[i]);                        
                }                    
            }
            let lines = [];
            if(r.rows.length > 0){
                for(let row of r.rows){
                    let line = [];
                    for(let name in row){
                        if(FieldName.indexOf(name) == -1) continue;
                        else{
                            let i = FieldName.indexOf(name);
                            if(FieldName[i] == name) line.push(row[name] || ''); 
                        }
                    }
                    lines.push(line);
                }
                
            }

            resp.render('exportHTML',{
                title: OoodType,
                header:header,
                lines:lines
            });
        }
        
    } catch (e) {
        logger.error('# Ошибка при скачивании файла: ' + e.stack);    
        return resp.status(500).json({errorno: e.code || 500, text: e.text || e.message});
    }
}