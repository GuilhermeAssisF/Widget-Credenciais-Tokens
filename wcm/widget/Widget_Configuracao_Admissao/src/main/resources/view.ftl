<div id="Widget_Configuracao_Admissao_${instanceId}" class="super-widget wcm-widget-class fluig-style-guide" data-params="Widget_Configuracao_Admissao.instance()">
    
    <!-- CABEÇALHO GERAL -->
    <div class="row">
        <div class="col-md-12">
            <h2 class="page-header">
                <i class="flaticon flaticon-settings icon-lg"></i> 
                Configurações da Admissão IRHO
            </h2>
        </div>
    </div>

    <!-- TELA 1: DASHBOARD (Listagem / Acesso) -->
    <div id="view_dashboard_${instanceId}">
        <div class="panel panel-default">
            <div class="panel-heading">
                <h3 class="panel-title"><i class="flaticon flaticon-list icon-sm"></i> Status da Configuração</h3>
            </div>
            <div class="panel-body text-center" style="padding: 40px;">
                
                <!-- Ícone de Status Dinâmico -->
                <div id="status_icon_${instanceId}" style="font-size: 4em; color: #ccc; margin-bottom: 20px;">
                    <i class="flaticon flaticon-system-clock"></i>
                </div>

                <h3 id="status_text_${instanceId}">Carregando dados...</h3>
                <p id="status_subtext_${instanceId}" class="text-muted">Verificando se já existe uma configuração ativa neste servidor.</p>

                <div style="max-width: 400px; margin: 30px auto;">
                    
                    <!-- Botão de Criar (Aparece só se não tiver config) -->
                    <button type="button" class="btn btn-success btn-lg btn-block" id="btn_criar_config_${instanceId}" style="display:none;" data-new-config>
                        <i class="flaticon flaticon-add-plus icon-sm"></i> CRIAR NOVA CONFIGURAÇÃO
                    </button>

                    <!-- Área de Autenticação (Aparece se já tiver config) -->
                    <div id="area_autenticacao_${instanceId}" style="display:none; text-align: left;">
                        <div class="alert alert-warning text-center">Configuração já existe. <br>Por segurança, insira a senha administrativa para editar.</div>
                        <div class="form-group">
                            <label>Senha de Acesso Módulo</label>
                            <input type="password" class="form-control" id="pwd_acesso_${instanceId}" placeholder="Digite a senha para habilitar a edição">
                        </div>
                        <button type="button" class="btn btn-primary btn-block" id="btn_editar_config_${instanceId}" disabled>
                            <i class="flaticon flaticon-edit icon-sm"></i> LIBERAR EDIÇÃO
                        </button>
                    </div>

                </div>
            </div>
        </div>
    </div>

    <!-- TELA 2: FORMULÁRIO DE EDIÇÃO (Visível apenas após Criar ou Autenticar) -->
    <div id="view_formulario_${instanceId}" style="display:none;">
        <div class="text-right" style="margin-bottom: 15px;">
            <button type="button" class="btn btn-default" data-back-dashboard>
                <i class="flaticon flaticon-arrow-left icon-sm"></i> Voltar ao Painel Interno
            </button>
        </div>

        <div class="panel panel-primary">
        <div class="panel-heading">
            <h3 class="panel-title"><i class="flaticon flaticon-security icon-sm"></i> Credenciais de Integração (RM e Fluig)</h3>
        </div>
        <div class="panel-body">
            <div class="row">
                <!-- Campo Hidden para o Upsert (Criar vs Editar) -->
                <input type="hidden" id="config_doc_id_${instanceId}" name="config_doc_id">
                
                <div class="col-md-6 form-group">
                    <label for="FLUIG_SOAP_USER_${instanceId}">Usuário Integração Fluig (SOAP)</label>
                    <input type="text" class="form-control" id="FLUIG_SOAP_USER_${instanceId}" name="FLUIG_SOAP_USER" placeholder="ex: app.candidato">
                </div>
                <div class="col-md-6 form-group">
                    <label for="FLUIG_SOAP_PASS_${instanceId}">Senha Integração Fluig (SOAP)</label>
                    <input type="password" class="form-control" id="FLUIG_SOAP_PASS_${instanceId}" name="FLUIG_SOAP_PASS">
                </div>
            </div>

            <div class="row">
                <div class="col-md-6 form-group">
                    <label for="RM_USER_${instanceId}">Usuário TOTVS RM</label>
                    <input type="text" class="form-control" id="RM_USER_${instanceId}" name="RM_USER">
                </div>
                <div class="col-md-6 form-group">
                    <label for="RM_PASS_${instanceId}">Senha TOTVS RM</label>
                    <input type="password" class="form-control" id="RM_PASS_${instanceId}" name="RM_PASS">
                </div>
            </div>
            <div class="row">
                <div class="col-md-12 form-group">
                    <label for="RM_ENDPOINT_WS_${instanceId}">Endpoint WSDATASERVER (RM)</label>
                    <input type="text" class="form-control" id="RM_ENDPOINT_WS_${instanceId}" name="RM_ENDPOINT_WS" placeholder="ex: http://rm.suaempresa.com.br:8051">
                </div>
            </div>

            <hr>
            <h4>Parâmetros OAuth (Fluig Public API)</h4>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label for="FLUIG_OAUTH_CONSUMER_KEY_${instanceId}">Consumer Key</label>
                    <input type="text" class="form-control" id="FLUIG_OAUTH_CONSUMER_KEY_${instanceId}" name="FLUIG_OAUTH_CONSUMER_KEY">
                </div>
                <div class="col-md-6 form-group">
                    <label for="FLUIG_OAUTH_CONSUMER_SECRET_${instanceId}">Consumer Secret</label>
                    <input type="password" class="form-control" id="FLUIG_OAUTH_CONSUMER_SECRET_${instanceId}" name="FLUIG_OAUTH_CONSUMER_SECRET">
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 form-group">
                    <label for="FLUIG_OAUTH_TOKEN_${instanceId}">Access Token</label>
                    <input type="text" class="form-control" id="FLUIG_OAUTH_TOKEN_${instanceId}" name="FLUIG_OAUTH_TOKEN">
                </div>
                <div class="col-md-6 form-group">
                    <label for="FLUIG_OAUTH_TOKEN_SECRET_${instanceId}">Token Secret</label>
                    <input type="password" class="form-control" id="FLUIG_OAUTH_TOKEN_SECRET_${instanceId}" name="FLUIG_OAUTH_TOKEN_SECRET">
                </div>
            </div>
            <hr>
            <h4>Credenciais TOTVS Assinatura Eletrônica (TAE)</h4>
            <div class="row">
                <div class="col-md-4 form-group">
                    <label for="TAE_USER_${instanceId}">Usuário (E-mail de Serviço)</label>
                    <input type="text" class="form-control" id="TAE_USER_${instanceId}" name="TAE_USER" placeholder="ex: svc@suaempresa.com">
                </div>
                <div class="col-md-4 form-group">
                    <label for="TAE_PASS_${instanceId}">Senha</label>
                    <input type="password" class="form-control" id="TAE_PASS_${instanceId}" name="TAE_PASS">
                </div>
                <div class="col-md-4 form-group">
                    <label for="URL_BASE_TAE_${instanceId}">URL Base TOTVS Assinatura (TAE)</label>
                    <input type="text" class="form-control" id="URL_BASE_TAE_${instanceId}" name="URL_BASE_TAE" value="https://totvssign.totvs.app">
                </div>
            </div>
        </div>
    </div>

    <div class="panel panel-info">
        <div class="panel-heading">
            <h3 class="panel-title"><i class="flaticon flaticon-link icon-sm"></i> URLs das Páginas Públicas</h3>
        </div>
        <div class="panel-body">
            <div class="row">
                <div class="col-md-12 form-group">
                    <label for="URL_PAGINA_CANDIDATO_${instanceId}">URL Página do Candidato</label>
                    <input type="text" class="form-control" id="URL_PAGINA_CANDIDATO_${instanceId}" name="URL_PAGINA_CANDIDATO" placeholder="ex: https://portal.suaempresa.com.br/portal/candidato">
                </div>
            </div>
            <div class="row">
                <div class="col-md-12 form-group">
                    <label for="URL_PAGINA_CORRECAO_${instanceId}">URL Página de Correção</label>
                    <input type="text" class="form-control" id="URL_PAGINA_CORRECAO_${instanceId}" name="URL_PAGINA_CORRECAO">
                </div>
            </div>
            <div class="row">
                <div class="col-md-12 form-group">
                    <label for="URL_PAGINA_ASSINATURA_${instanceId}">URL Página de Assinatura</label>
                    <input type="text" class="form-control" id="URL_PAGINA_ASSINATURA_${instanceId}" name="URL_PAGINA_ASSINATURA">
                </div>
            </div>
        </div>     
    </div>

    <div class="panel panel-success">
        <div class="panel-heading">
            <h3 class="panel-title"><i class="flaticon flaticon-process icon-sm"></i> Mapeamento do Workflow</h3>
        </div>
        <div class="panel-body">
            <div class="row">
                <div class="col-md-6 form-group">
                    <label for="FLUIG_PROCESS_ID_ADMISSAO_${instanceId}">Código/ID do Processo Fluig</label>
                    <input type="text" class="form-control" id="FLUIG_PROCESS_ID_ADMISSAO_${instanceId}" name="FLUIG_PROCESS_ID_ADMISSAO" value="FLUIG-0002 - Admissão IRHO" placeholder="Ex: Admissao_IRHO_PROD">
                </div>
                <div class="col-md-2 form-group">
                    <label for="ATIVIDADE_CANDIDATO_DADOS_${instanceId}">Atividade: Dados</label>
                    <input type="number" class="form-control" id="ATIVIDADE_CANDIDATO_DADOS_${instanceId}" name="ATIVIDADE_CANDIDATO_DADOS" value="122">
                </div>
                <div class="col-md-2 form-group">
                    <label for="ATIVIDADE_CANDIDATO_CORRECAO_${instanceId}">Atividade: Correção</label>
                    <input type="number" class="form-control" id="ATIVIDADE_CANDIDATO_CORRECAO_${instanceId}" name="ATIVIDADE_CANDIDATO_CORRECAO" value="150">
                </div>
                <div class="col-md-2 form-group">
                    <label for="ATIVIDADE_CANDIDATO_ASSINATURA_${instanceId}">Atividade: Assinatura</label>
                    <input type="number" class="form-control" id="ATIVIDADE_CANDIDATO_ASSINATURA_${instanceId}" name="ATIVIDADE_CANDIDATO_ASSINATURA" value="129">
                </div>
                <div class="col-md-2 form-group">
                    <label for="ATIVIDADE_RH_CONCLUSAO_${instanceId}">Atividade: Conclusão</label>
                    <input type="number" class="form-control" id="ATIVIDADE_RH_CONCLUSAO_${instanceId}" name="ATIVIDADE_RH_CONCLUSAO" value="104">
                </div>
            </div>
            <div class="row">
                <div class="col-md-12">
                    <p class="text-muted" style="font-size: 11px; margin-top: 5px;">
                        <i class="flaticon flaticon-alert icon-sm"></i> 
                        Estes IDs referem-se ao número das caixas (tarefas) desenhadas no Studio/Web. São essenciais para o Painel de Admissão saber quando deve libertar os links externos.
                    </p>
                </div>
            </div>
        </div>
    </div>

    <div class="panel panel-danger">
        <div class="panel-heading">
            <h3 class="panel-title"><i class="flaticon flaticon-settings-applications icon-sm"></i> Configurações Avançadas de Sistema</h3>
        </div>
        <div class="panel-body">
            <div class="row">
                <div class="col-md-4 form-group">
                    <label for="FLUIG_TENANT_ID_${instanceId}">Tenant ID (Empresa Fluig)</label>
                    <input type="number" class="form-control" id="FLUIG_TENANT_ID_${instanceId}" name="FLUIG_TENANT_ID" value="1" placeholder="Ex: 1">
                </div>
                <div class="col-md-4 form-group">
                    <label for="ID_PASTA_FORMULARIO_${instanceId}">ID da Pasta do Formulário</label>
                    <input type="number" class="form-control" id="ID_PASTA_FORMULARIO_${instanceId}" name="ID_PASTA_FORMULARIO" placeholder="Ex: 3483">
                </div>
                <div class="col-md-4 form-group">
                    <label for="ID_PASTA_RAIZ_CANDIDATOS_${instanceId}">ID Pasta Raiz (Geração de Pastas)</label>
                    <input type="number" class="form-control" id="ID_PASTA_RAIZ_CANDIDATOS_${instanceId}" name="ID_PASTA_RAIZ_CANDIDATOS" value="3479" placeholder="Ex: 3479">
                </div>
            </div>
        </div>
    </div>

    <div class="panel panel-warning">
        <div class="panel-heading">
            <h3 class="panel-title"><i class="flaticon flaticon-company icon-sm"></i> Parametrização por Filial</h3>
        </div>
        <div class="panel-body">

            <div class="aviso-coligadas">
                <div class="aviso-coligadas-titulo">
                    <i class="flaticon flaticon-info-sign icon-sm"></i> Dica de Preenchimento: Apelidos das Coligadas
                </div>
                <div class="pilulas-container">
                    <span class="pilula-coligada">01 - Holding</span>
                    <span class="pilula-coligada">02 - Lajinha</span>
                    <span class="pilula-coligada">03 - Brejetuba</span>
                    <span class="pilula-coligada">04 - Serviços</span>
                    <span class="pilula-coligada">05 - Paraguaçu</span>
                    <span class="pilula-coligada">06 - Campina Verde</span>
                </div>
            </div>

            <div class="row" style="background: #fdfdfd; padding: 15px 0; border: 1px dashed #ccc; border-radius: 6px; margin-bottom: 20px;">
                <div class="col-md-4 form-group">
                    <label>Empresa/Filial</label>
                    <select class="form-control" id="ADD_FILIAL_${instanceId}">
                        <option value="">Carregando filiais...</option>
                    </select>
                </div>
                <div class="col-md-3 form-group">
                    <label>Banco</label>
                    <select class="form-control" id="ADD_BANCO_${instanceId}">
                        <option value="">Carregando bancos...</option>
                    </select>
                </div>
                <div class="col-md-2 form-group">
                    <label>Agência</label>
                    <select class="form-control" id="ADD_AGENCIA_${instanceId}" disabled>
                        <option value="">Aguardando Banco...</option>
                    </select>
                </div>
                <div class="col-md-2 form-group">
                    <label>% Adiant.</label>
                    <input type="number" class="form-control" id="ADD_PADT_${instanceId}" placeholder="Ex: 40">
                </div>
                <div class="col-md-1 form-group" style="padding-top: 25px;">
                    <button type="button" class="btn btn-primary btn-block" id="btn_add_param_${instanceId}" title="Adicionar Regra">
                        <i class="flaticon flaticon-add-plus icon-sm"></i>
                    </button>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-striped table-hover" id="tbl_parametros_${instanceId}">
                    <thead>
                        <tr>
                            <th>Cód. Empresa</th>
                            <th>Cód. Filial</th>
                            <th>Banco</th>
                            <th>Agência</th> <th>Adiantamento (%)</th>
                            <th style="width: 80px;">Ação</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="text-right">
        <button type="button" class="btn btn-success btn-lg" data-save-config>
            <i class="flaticon flaticon-save icon-sm"></i> SALVAR CONFIGURAÇÕES
        </button>
    </div>

</div>

