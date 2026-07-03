function defineStructure() { }

function onSync(lastSyncDate) { }

function createDataset(fields, constraints, sortFields) {
    var dataset = DatasetBuilder.newDataset();
    dataset.addColumn("status");
    dataset.addColumn("message");
    dataset.addColumn("response");

    var action = "";
    var payloadStr = "{}";

    try {
        if (constraints != null && constraints.length > 0) {
            for (var i = 0; i < constraints.length; i++) {
                if (constraints[i].fieldName == "action" || constraints[i].fieldName == "_action") {
                    action = constraints[i].initialValue;
                }
                if (constraints[i].fieldName == "payload" || constraints[i].fieldName == "_payload") {
                    payloadStr = constraints[i].initialValue;
                }
            }
        }

        if (action == "") throw "Ação não informada. Utilize constraint 'action'.";

        var payload = JSON.parse(payloadStr);
        var configuracoes = getConfiguracoes();
        if (!configuracoes) throw "Configurações de Admissão não encontradas.";

        var responseData = {};

        switch (String(action)) {
            case "TAE_API_CALL":
                responseData = doTaeApiCall(payload, configuracoes);
                break;
            case "TAE_CRIAR_LOTE":
                    responseData = doTaeCriarLote(payload, configuracoes);
                    break;
            case "SAVE_AND_SEND_TASK":
                responseData = doSaveAndSendTask(payload, configuracoes);
                break;
            case "UPLOAD_ATTACHMENT":
                responseData = doUploadAttachment(payload, configuracoes);
                break;
            case "UPDATE_CARD_DATA":
                responseData = doUpdateCardData(payload, configuracoes);
                break;
            case "GET_REQUEST_DETAILS":
                responseData = doGetRequestDetails(payload, configuracoes);
                break;
            case "GET_DATASET":
                responseData = doGetDataset(payload);
                break;
            case "GET_DOWNLOAD_URL":
                responseData = doGetDownloadUrl(payload, configuracoes);
                break;
            default:
                throw "Ação não suportada pelo proxy: " + action;
        }

        // BYPASS: Se a resposta já vier pronta como String (TAE), não passa pelo stringify bugado do Fluig
        var respostaFinal = "";
        if (typeof responseData === "string") {
            respostaFinal = responseData;
        } else {
            respostaFinal = JSON.stringify(responseData);
        }

        dataset.addRow(["success", "Ação executada com sucesso", respostaFinal]);

    } catch (e) {
        log.error("ds_irho_api_proxy ERRO: " + e.toString());
        dataset.addRow(["error", e.toString(), "{}"]);
    }

    return dataset;
}

function onMobileSync(user) { }

// ===========================================
// FUNÇÕES DE APOIO
// ===========================================

function getConfiguracoes() {
    var ds = DatasetFactory.getDataset("Form_Configuracoes_Admissao", null, [
        DatasetFactory.createConstraint("metadata#active", "true", "true", ConstraintType.MUST)
    ], null);

    if (ds && ds.rowsCount > 0) {
        return {
            RM_USER: String(ds.getValue(0, "RM_USER") || ""),
            RM_PASS: String(ds.getValue(0, "RM_PASS") || ""),
            RM_ENDPOINT_WS: String(ds.getValue(0, "RM_ENDPOINT_WS") || ""),
            FLUIG_OAUTH_CONSUMER_KEY: String(ds.getValue(0, "FLUIG_OAUTH_CONSUMER_KEY") || ""),
            FLUIG_OAUTH_CONSUMER_SECRET: String(ds.getValue(0, "FLUIG_OAUTH_CONSUMER_SECRET") || ""),
            FLUIG_OAUTH_TOKEN: String(ds.getValue(0, "FLUIG_OAUTH_TOKEN") || ""),
            FLUIG_OAUTH_TOKEN_SECRET: String(ds.getValue(0, "FLUIG_OAUTH_TOKEN_SECRET") || ""),
            FLUIG_SOAP_USER: String(ds.getValue(0, "FLUIG_SOAP_USER") || ""),
            FLUIG_SOAP_PASS: String(ds.getValue(0, "FLUIG_SOAP_PASS") || ""),
            
            FLUIG_TENANT_ID: String(ds.getValue(0, "FLUIG_TENANT_ID") || "1"),
            
            // CREDENCIAIS DA TOTVS ASSINATURA (TAE) AQUI:
            TAE_USER: String(ds.getValue(0, "TAE_USER") || ""),
            TAE_PASS: String(ds.getValue(0, "TAE_PASS") || "")
        };
    }
    return null;
}

// ===========================================
// MÉTODOS DE AÇÃO DO PROXY
// ===========================================

function doSaveAndSendTask(payload, config) {
    var companyId = config.FLUIG_TENANT_ID;

    var xmlSoap = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.workflow.ecm.technology.totvs.com/">' +
        '<soapenv:Header/><soapenv:Body><ws:saveAndSendTask>' +
        '<username>' + config.FLUIG_SOAP_USER + '</username>' +
        '<password>' + config.FLUIG_SOAP_PASS + '</password>' +
        '<companyId>' + companyId + '</companyId>' +
        '<processInstanceId>' + payload.processInstanceId + '</processInstanceId>' +
        '<choosedState>' + payload.choosedState + '</choosedState>' +
        '<colleagueIds><item>System:Auto</item></colleagueIds>' +
        '<comments>' + (payload.comments || '') + '</comments>' +
        '<userId>' + config.FLUIG_SOAP_USER + '</userId>' +
        '<completeTask>true</completeTask>' +
        '<attachments>' + (payload.attachmentsXml || '') + '</attachments>' +
        '<cardData>' + (payload.cardDataXml || '') + '</cardData>' +
        '<appointment></appointment>' +
        '<managerMode>true</managerMode>' +
        '<threadSequence>0</threadSequence>' +
        '</ws:saveAndSendTask></soapenv:Body></soapenv:Envelope>';

    return callInternalFluigAPI(config, "/webdesk/ECMWorkflowEngineService?wsdl", "POST", xmlSoap, "text/xml;charset=utf-8");
}

function doUpdateCardData(payload, config) {
    var companyId = config.FLUIG_TENANT_ID;

    function escapeXML(str) {
        if (str === undefined || str === null) return "";

        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    if (!payload.cardId) {
        throw "UPDATE_CARD_DATA: cardId não informado.";
    }

    if (!payload.cardData && !payload.cardDataXml) {
        throw "UPDATE_CARD_DATA: cardData/cardDataXml não informado.";
    }

    var cardDataXml = "";
    var camposLog = [];

    if (payload.cardData) {
        var dadosObjeto = payload.cardData;

        for (var key in dadosObjeto) {
            if (dadosObjeto.hasOwnProperty(key)) {
                var nomeCampo = String(key || "").trim();

                if (nomeCampo === "") {
                    continue;
                }

                var valor = dadosObjeto[key];

                if (valor === undefined || valor === null) {
                    valor = "";
                }

                valor = String(valor);

                camposLog.push(nomeCampo + "(" + valor.length + ")");

                cardDataXml +=
                    "<item>" +
                    "<field>" + escapeXML(nomeCampo) + "</field>" +
                    "<value>" + escapeXML(valor) + "</value>" +
                    "</item>";
            }
        }
    } else if (payload.cardDataXml) {
        cardDataXml = String(payload.cardDataXml);
        camposLog.push("cardDataXml(" + cardDataXml.length + ")");
    }

    log.info("UPDATE_CARD_DATA cardId=" + payload.cardId + " campos=" + camposLog.join(", "));

    var xmlSoap =
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.dm.ecm.technology.totvs.com/">' +
        '<soapenv:Header/>' +
        '<soapenv:Body>' +
        '<ws:updateCardData>' +
        '<companyId>' + escapeXML(companyId) + '</companyId>' +
        '<username>' + escapeXML(config.FLUIG_SOAP_USER) + '</username>' +
        '<password>' + escapeXML(config.FLUIG_SOAP_PASS) + '</password>' +
        '<cardId>' + escapeXML(payload.cardId) + '</cardId>' +
        '<cardData>' + cardDataXml + '</cardData>' +
        '</ws:updateCardData>' +
        '</soapenv:Body>' +
        '</soapenv:Envelope>';

    var retorno = callInternalFluigAPI(
        config,
        "/webdesk/ECMCardService?wsdl",
        "POST",
        xmlSoap,
        "text/xml;charset=utf-8"
    );

    log.info("UPDATE_CARD_DATA retorno HTTP=" + retorno.status);

    if (Number(retorno.status) >= 400) {
        log.error("UPDATE_CARD_DATA falhou. cardId=" + payload.cardId + " campos=" + camposLog.join(", "));
        log.error("UPDATE_CARD_DATA resposta=" + String(retorno.response || "").substring(0, 3000));

        return {
            success: false,
            status: Number(retorno.status),
            message: "Falha no updateCardData",
            fields: camposLog,
            response: String(retorno.response || "")
        };
    }

    return {
        success: true,
        status: Number(retorno.status),
        fields: camposLog,
        response: String(retorno.response || "")
    };
}

function doGetDataset(payload) {
    var c = [];
    if (payload.constraints) {
        for (var i = 0; i < payload.constraints.length; i++) {
            var pc = payload.constraints[i];
            var type = ConstraintType.MUST;
            if (pc._type == 2) type = ConstraintType.SHOULD;
            if (pc._type == 3) type = ConstraintType.MUST_NOT;
            c.push(DatasetFactory.createConstraint(pc._field, pc._initialValue, pc._finalValue, type));
        }
    }

    var ds = DatasetFactory.getDataset(payload.name, null, c, null);
    var records = [];
    if (ds && ds.rowsCount > 0) {
        for (var r = 0; r < ds.rowsCount; r++) {
            var obj = {};
            for (var col = 0; col < ds.getColumnsCount(); col++) {
                // 1. Garante que o nome da coluna é uma string JS nativa
                var colName = String(ds.getColumnName(col)); 
                
                // 2. Garante que o valor é uma string JS nativa (e trata nulos)
                var rawValue = ds.getValue(r, colName);
                obj[colName] = rawValue != null ? String(rawValue) : ""; 
            }
            records.push(obj);
        }
    }

    return { records: records };
}

function doUploadAttachment(payload, config) {
    var companyId = config.FLUIG_TENANT_ID;
    
    var cleanBase64 = payload.base64;
    if (cleanBase64.indexOf(",") > -1) {
        cleanBase64 = cleanBase64.split(",")[1];
    }

    var xmlSoap = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.workflow.ecm.technology.totvs.com/">' +
        '<soapenv:Header/>' +
        '<soapenv:Body>' +
        '<ws:saveAndSendTask>' +
        '<username>' + config.FLUIG_SOAP_USER + '</username>' +
        '<password>' + config.FLUIG_SOAP_PASS + '</password>' +
        '<companyId>' + companyId + '</companyId>' +
        '<processInstanceId>' + payload.processInstanceId + '</processInstanceId>' +
        '<choosedState>0</choosedState>' +
        '<colleagueIds></colleagueIds>' +
        '<comments>Upload de anexo (via Widget Candidato)</comments>' +
        '<userId>' + config.FLUIG_SOAP_USER + '</userId>' +
        '<completeTask>false</completeTask>' +
        '<attachments>' +
            '<item>' +
                '<attachmentSequence>0</attachmentSequence>' +
                '<attachments>' +
                    '<attach>true</attach>' +
                    '<fileName>' + payload.fileName + '</fileName>' +
                    '<filecontent>' + cleanBase64 + '</filecontent>' +
                '</attachments>' +
                '<description>' + (payload.description || payload.fileName) + '</description>' +
                '<fileName>' + payload.fileName + '</fileName>' +
            '</item>' +
        '</attachments>' +
        '<cardData></cardData>' +
        '<appointment></appointment>' +
        '<managerMode>true</managerMode>' +
        '<threadSequence>0</threadSequence>' +
        '</ws:saveAndSendTask>' +
        '</soapenv:Body>' +
        '</soapenv:Envelope>';

    return callInternalFluigAPI(config, "/webdesk/ECMWorkflowEngineService?wsdl", "POST", xmlSoap, "text/xml;charset=utf-8");
}

function doGetDownloadUrl(payload, config) {
    // Call the Fluig API securely using OAuth tokens to bypass Guest lack of privileges
    return callInternalFluigAPI(config, "/api/public/2.0/documents/getDownloadURL/" + payload.documentId, "GET", "");
}

function doGetRequestDetails(payload, config) {
    var processInstanceId = payload.processInstanceId;
    var expand = payload.expand || "cardFields";
    var path = "/api/public/2.0/workflows/requests/" + processInstanceId + "/sla?expand=" + expand;
    return callInternalFluigAPI(config, path, "GET", "");
}

function callInternalFluigAPI(config, path, method, body, contentType) {
    var serverUrl = "";

    try {
        // Tenta pegar a URL do servidor nativamente via fluigAPI (funciona na maioria dos ambientes de dataset modernos)
        serverUrl = fluigAPI.getPageService().getServerURL();
    } catch (e) {
        log.warn("Proxy: fallback para fluigAPI falhou, tentando tenant service.");
        try {
            var tenantService = fluigAPI.getTenantService();
            if (tenantService) {
                // Montamos a URL do tenant
                var urlObj = new java.net.URL(tenantService.getTenantById(1).getUrl());
                serverUrl = urlObj.getProtocol() + "://" + urlObj.getHost() + (urlObj.getPort() !== -1 ? ":" + urlObj.getPort() : "");
            }
        } catch (e2) {
            log.warn("Proxy: fallback de URL falhou, usando host header local caso disponivel.");
            serverUrl = "http://localhost:8080";
        }
    }

    log.info("Proxy chamando Backend: " + serverUrl + path);

    var connection = null;
    try {
        var urlObject = new java.net.URL(serverUrl + path);
        connection = urlObject.openConnection();
        connection.setRequestMethod(method);

        if (contentType) {
            connection.setRequestProperty("Content-Type", contentType);
        }

        if (body && (method == "POST" || method == "PUT")) {
            connection.setDoOutput(true);
            var os = connection.getOutputStream();
            var outText = new java.lang.String(body);
            os.write(outText.getBytes("UTF-8"));
            os.flush();
            os.close();
        }

        var responseCode = connection.getResponseCode();
        var is = (responseCode >= 200 && responseCode < 300) ? connection.getInputStream() : connection.getErrorStream();

        var scanner = new java.util.Scanner(is, "UTF-8").useDelimiter("\\A");
        var responseBody = scanner.hasNext() ? scanner.next() : "";

        scanner.close();

        return {
            status: Number(responseCode),
            response: String(responseBody)
        };

    } catch (e) {
        log.error("ERRO NO PROXY: " + e.toString());
        throw "Erro na comunicação Backend (" + path + "): " + e.toString();
    } finally {
        if (connection != null) {
            connection.disconnect();
        }
    }
}

function doTaeApiCall(payload, config) {
    // BLINDAGEM DE SEGURANÇA: Injeta as senhas do backend forçando String nativa!
    if (payload.endpoint.indexOf("/auth/login") > -1) {
        payload.body = {
            username: String(config.TAE_USER),
            password: String(config.TAE_PASS)
        };
    }

    // 1. Por padrão assume a rota de Identidade (Login)
    var taeBaseUrl = "https://totvssign.totvs.app/identityintegration"; 

    // 2. Se for a V2 de Publicações ou Assinaturas, manda para o SignIntegration
    if (payload.endpoint.indexOf("/v2/Publicacoes") > -1 || payload.endpoint.indexOf("/assinaturas") > -1) {
        taeBaseUrl = "https://totvssign.totvs.app/signintegration";
    } 
    // 3. Se for Upload, Download ou qualquer V1, manda para o Documents!
    else if (payload.endpoint.indexOf("/v1/") > -1) {
        taeBaseUrl = "https://totvssign.totvs.app/documents"; 
    }

    var serverUrl = taeBaseUrl + payload.endpoint;
    log.info(">>> PROXY TAE: Chamando " + serverUrl);

    var responseCode = 500;
    var responseString = "";

    // ====================================================================
    // UPLOAD USANDO APACHE HTTP CLIENT
    // ====================================================================
    if (payload.body && payload.body.isMultipart && payload.method == "POST") {
        try {
            var httpClient = org.apache.http.impl.client.HttpClients.createDefault();
            var httpPost = new org.apache.http.client.methods.HttpPost(serverUrl);
            
            httpPost.setHeader("Authorization", "Bearer " + payload.token);
            httpPost.setHeader("Accept", "application/json");

            var builder = org.apache.http.entity.mime.MultipartEntityBuilder.create();
            builder.setMode(org.apache.http.entity.mime.HttpMultipartMode.BROWSER_COMPATIBLE);

            var nomeLimpo = String(payload.body.fileName).replace(".pdf", "");
            builder.addTextBody("NomeEnvelope", nomeLimpo, org.apache.http.entity.ContentType.create("text/plain", org.apache.http.Consts.UTF_8));

            var fileBytes = java.util.Base64.getDecoder().decode(payload.body.base64);
            builder.addBinaryBody("Envelope", fileBytes, org.apache.http.entity.ContentType.create("application/pdf"), payload.body.fileName);

            var multipartEntity = builder.build();
            httpPost.setEntity(multipartEntity);

            var response = httpClient.execute(httpPost);
            var responseEntity = response.getEntity();
            
            responseCode = response.getStatusLine().getStatusCode();
            if (responseEntity != null) {
                responseString = String(org.apache.http.util.EntityUtils.toString(responseEntity, "UTF-8"));
            }
        } catch (e) {
            throw "Erro no Upload Apache Http: " + e.toString();
        }
    } 
    // ====================================================================
    // REQUISIÇÕES JSON NORMAIS E DOWNLOADS
    // ====================================================================
    else {
        var connection = null;
        try {
            var urlObject = new java.net.URL(serverUrl);
            connection = urlObject.openConnection();
            connection.setRequestMethod(payload.method);
            connection.setRequestProperty("Accept", "application/json");

            if (payload.token) {
                connection.setRequestProperty("Authorization", "Bearer " + payload.token);
            }

            if (payload.body && (payload.method == "POST" || payload.method == "PUT")) {
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                var os = connection.getOutputStream();
                var outText = new java.lang.String(JSON.stringify(payload.body));
                os.write(outText.getBytes("UTF-8"));
                os.flush();
                os.close();
            }

            // AQUI ESTÁ A MÁGICA DE LER ARQUIVOS COMPACTADOS (GZIP) E PDF:
            responseCode = connection.getResponseCode();
            var contentType = String(connection.getContentType() || "").toLowerCase();
            var encoding = String(connection.getContentEncoding() || "").toLowerCase();
            
            var is = (responseCode >= 200 && responseCode < 300) ? connection.getInputStream() : connection.getErrorStream();
            
            if (is != null) {
                // 1. Descompacta o GZIP se a TOTVS mandar compactado
                if (encoding.indexOf("gzip") > -1) {
                    is = new java.util.zip.GZIPInputStream(is);
                }

                // 2. Se for arquivo PDF binário, usamos o IOUtils nativo do Fluig para não corromper NENHUM byte!
                if (responseCode >= 200 && responseCode < 300 && (contentType.indexOf("pdf") > -1 || contentType.indexOf("octet-stream") > -1 || contentType.indexOf("zip") > -1)) {
                    
                    var bytes = org.apache.commons.io.IOUtils.toByteArray(is);
                    var base64String = java.util.Base64.getEncoder().encodeToString(bytes);
                    
                    responseString = '{"success":true,"base64":"' + base64String + '"}';
                } 
                // 3. Se for JSON/Texto normal
                else {
                    var scanner = new java.util.Scanner(is, "UTF-8").useDelimiter("\\A");
                    responseString = scanner.hasNext() ? String(scanner.next()) : "";
                    scanner.close();
                }
            }

        } catch (e) {
            throw "Erro na comunicação TAE: " + e.toString();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    // ====================================================================
    // SANITIZAÇÃO DA RESPOSTA (O SEGREDO PARA NÃO QUEBRAR O FLUIG)
    // ====================================================================
    var cleanBody = "";
    if (responseString) { 
        cleanBody = String(responseString).replace(/\r/g, "").replace(/\n/g, "").replace(/\t/g, " ").trim();
    }
    
    if (!cleanBody) {
        cleanBody = '{"message":"Resposta vazia do servidor (HTTP Status ' + responseCode + ')"}';
    }
    
    if (cleanBody.indexOf("<") === 0) {
        cleanBody = JSON.stringify({ error: cleanBody.substring(0, 50) });
    }

    return '{"status":' + Number(responseCode) + ',"response":' + cleanBody + '}';
}

function doTaeCriarLote(payload, config) {
    var token = payload.token;
    var documentos = payload.documentos;
    var destinatarios = payload.destinatarios;
    var baseUrl = config.URL_BASE_TAE || "https://totvssign.totvs.app";
    
    if (!documentos || documentos.length === 0) throw "Lista de documentos vazia.";

    var httpClient = org.apache.http.impl.client.HttpClients.createDefault();

    try {
        // =====================================================================
        // PASSO 1: UPLOAD MASSIVO DE TODOS OS ARQUIVOS NUMA ÚNICA REQUISIÇÃO
        // =====================================================================
        log.info(">>> TAE PROXY: Iniciando Lote com " + documentos.length + " arquivos.");
        var urlUpload = baseUrl + "/documents/v1/envelopes/upload";
        
        var httpPost1 = new org.apache.http.client.methods.HttpPost(urlUpload);
        httpPost1.setHeader("Authorization", "Bearer " + token);
        httpPost1.setHeader("Accept", "application/json");

        var builder1 = org.apache.http.entity.mime.MultipartEntityBuilder.create();
        builder1.setMode(org.apache.http.entity.mime.HttpMultipartMode.BROWSER_COMPATIBLE);
        
        var nomeLote = "Kit Admissional - " + (destinatarios[0].nomeCompleto || "Candidato");
        builder1.addTextBody("NomeEnvelope", nomeLote, org.apache.http.entity.ContentType.create("text/plain", org.apache.http.Consts.UTF_8));
        
        // LOOP MÁGICO: Adiciona todos os PDFs na mesma requisição, todos usando a chave "Envelope" (como array)
        for (var i = 0; i < documentos.length; i++) {
            var docAtual = documentos[i];
            var safeName = String(docAtual.fileName).replace(/[^\w\d\.\-]/g, "_");
            var fileBytes = java.util.Base64.getDecoder().decode(docAtual.base64);
            
            // A chave "Envelope" repete-se. O Java/Apache HttpClients transforma isso num Array nativamente
            builder1.addBinaryBody("Envelope", fileBytes, org.apache.http.entity.ContentType.create("application/pdf"), safeName);
        }

        httpPost1.setEntity(builder1.build());

        // Dispara tudo de uma vez
        log.info(">>> TAE PROXY: Enviando requisição Multipart com " + documentos.length + " arquivos.");
        var res1 = httpClient.execute(httpPost1);
        var str1 = org.apache.http.util.EntityUtils.toString(res1.getEntity(), "UTF-8");
        
        if (res1.getStatusLine().getStatusCode() >= 400) throw "Falha na Criação do Lote: " + str1;
        
        var json1 = JSON.parse(str1);
        var idDocTae = json1.idDocumento || (json1.data ? (typeof json1.data !== 'object' ? json1.data : json1.data.idDocumento) : null) || (json1.length > 0 ? json1[0].idDocumento : null);
        if (!idDocTae) throw "ID do Envelope não retornado: " + str1;
        
        log.info(">>> TAE PROXY: Rascunho de Lote criado com SUCESSO. ID: " + idDocTae);

        // =====================================================================
        // PASSO 2: PUBLICAR O ENVELOPE (Abre para Assinatura e dispara E-mail)
        // =====================================================================
        log.info(">>> TAE PROXY: Publicando envelope...");
        var urlPub = baseUrl + "/signintegration/v2/Publicacoes";
        var httpPost2 = new org.apache.http.client.methods.HttpPost(urlPub);
        httpPost2.setHeader("Authorization", "Bearer " + token);
        httpPost2.setHeader("Accept", "application/json");
        httpPost2.setHeader("Content-Type", "application/json");

        var payloadPub = {
            "idDocumento": Number(idDocTae), "utilizaworkflow": false, "responsavelAssinaDocumento": false,
            "publicacaoOpcoes": { "permiteRejeitarDocumento": true, "intervaloLembrete": 0 },
            "destinatarios": destinatarios
        };
        httpPost2.setEntity(new org.apache.http.entity.StringEntity(JSON.stringify(payloadPub), "UTF-8"));
        
        var res2 = httpClient.execute(httpPost2);
        var str2 = org.apache.http.util.EntityUtils.toString(res2.getEntity(), "UTF-8");
        
        if (res2.getStatusLine().getStatusCode() >= 400) throw "Falha na Publicação do Lote: " + str2;

        log.info(">>> TAE PROXY: Lote Publicado e Finalizado com sucesso!");

        return '{"success":true,"idDocumento":' + idDocTae + '}';

    } catch (err) {
        log.error(">>> ERRO TAE PROXY LOTE: " + err.toString());
        throw err.toString();
    }
}
