const dateFormat = require('dateformat');
const {GetAppAccessRole} = require(doc_root + '/lib/srv/common');
module.exports.Edit = async function Edit(req, resp){
    try{
        if(req.method !== 'POST') throw new Error('Нет доступа');
        let user_id = null;
        if(req.tokenPayload != null) user_id = req.tokenPayload.id;        
        else throw config.errors.sessionClose;
        
        let Role = await GetAppAccessRole('rks', user_id, req.tokenPayload.user_apps);
        if (Role <= 0 || Role == 100)  throw config.errors.forbidden;

        let query = req.body;
    
        if (query['name_last'] === '') throw new Error('Не указана фамилия');
            else if (query['name_first'] === '') throw new Error("Не указано имя");
            else if (query['birth_date'] === '') throw new Error("Не указана дата рождения");

            query.snils = query.snils || "";
            while(query.snils.indexOf(" ") > 0) query.snils = query.snils.substr(0, query.snils.indexOf(" ")) + query.snils.substr(query.snils.indexOf(" ") + 1);
            while(query.snils.indexOf("-") > 0) query.snils = query.snils.substr(0, query.snils.indexOf("-")) + query.snils.substr(query.snils.indexOf("-") + 1);
            while(query.snils.indexOf(".") > 0) query.snils = query.snils.substr(0, query.snils.indexOf(".")) + query.snils.substr(query.snils.indexOf(".") + 1);

            let pgQuery="select * from PERSDATA.fn_update_person($1::bigint, $2, $3, $4, $5::date, $6, $7, $8, $9::uuid, $10, $11, $12, $13::json, $14::json)";
            
            let querySerialize = [
                query.id == "" ? null : parseInt(query.id),
                query.name_last,
                query.name_first,
                query.name_mid==""?null:query.name_mid,
                dateFormat(new Date(query.birth_date), "yyyy-mm-dd"),
                query.inn  == "" ? null : query.inn,
                query.snils == "" ? null : query.snils,
                query.sex !== "*" ? parseInt(query.sex) : null,
                query.obj_uuid == "" ? null : query.obj_uuid,
                query.documents,
                query.relations,
                query.custmoves,
                query.addr_reg,
                query.addr_act 
            ];
            
            let client = null, r = null;
            client = await db.connect();
            try{
                r = await client.query(pgQuery, querySerialize);                
            }finally{
                client.release();
            }         
            logger.info('# Сохранение прошо успешно');
            resp.status(200).json({'id': r.rows[0].obj_id});

    }catch(e){
        let errText = e.text || e.message;
        let code = e.code || 500;
        logger.error('# Ошибка при сохранении данных: ' + e.stack);    
        return resp.status(500).json({errorno: code, text: errText});
    }
}