var Widget_Configuracao_Admissao = SuperWidget.extend({
    instanceId: null,
    documentId: null, // Mantém backup em memória caso o HTML com hidden cacheie
    itensEmMemoria: {},
    ID_PASTA_FORMULARIO: 17765,
    SENHA_MESTRE: 'mb2026', // Defina a senha desejada aqui
    parametrosFilial: [],

    init: function () {
        this.carregarDados();
        this.configurarEventosSenha();
        this.carregarSelectFiliais();
        this.carregarSelectBancos();

        var that = this;

        // NOVO: GATILHO PARA CARREGAR AGÊNCIA QUANDO O BANCO MUDAR
        $("#ADD_BANCO_" + this.instanceId).off('change').on('change', function () {
            var bancoSelecionado = $(this).val();
            that.carregarSelectAgencias(bancoSelecionado);
        });

        // Evento do Botão Adicionar
        $("#btn_add_param_" + this.instanceId).off('click').on('click', function () {
            var selectFilial = $("#ADD_FILIAL_" + that.instanceId);
            var selectBanco = $("#ADD_BANCO_" + that.instanceId);
            var selectAgencia = $("#ADD_AGENCIA_" + that.instanceId);

            var valFilial = selectFilial.val();
            var textoFilial = selectFilial.find("option:selected").text();

            // Tratamento: Só busca o texto se tiver valor selecionado
            var bco = selectBanco.val() || "";
            var textoBanco = bco ? selectBanco.find("option:selected").text() : "";

            var valAgencia = selectAgencia.val() || "";
            var textoAgencia = valAgencia ? selectAgencia.find("option:selected").text() : "";

            var padt = $("#ADD_PADT_" + that.instanceId).val() || "";

            // ==========================================
            // NOVA VALIDAÇÃO: SÓ A FILIAL É OBRIGATÓRIA
            // ==========================================
            if (valFilial) {
                var codEmp = valFilial.split("|")[0];
                var codFil = valFilial.split("|")[1];

                // VALIDAÇÃO DE DUPLICIDADE
                var filialJaExiste = false;
                for (var i = 0; i < that.parametrosFilial.length; i++) {
                    if (that.parametrosFilial[i].empresa == codEmp && that.parametrosFilial[i].filial == codFil) {
                        filialJaExiste = true; break;
                    }
                }
                if (filialJaExiste) {
                    FLUIGC.toast({ title: 'Operação Bloqueada: ', message: 'Esta Filial já possui uma parametrização.', type: 'danger' });
                    return;
                }

                that.parametrosFilial.push({
                    empresa: codEmp,
                    filial: codFil,
                    descFilial: textoFilial,
                    banco: bco,
                    descBanco: textoBanco,
                    agencia: valAgencia,
                    descAgencia: textoAgencia,
                    padt: padt
                });

                that.renderizarTabelaParametros();

                // Limpeza
                selectFilial.val('');
                selectBanco.val('');
                selectAgencia.empty().append('<option value="">Aguardando Banco...</option>').prop('disabled', true);
                $("#ADD_PADT_" + that.instanceId).val('');

            } else {
                FLUIGC.toast({ title: 'Atenção:', message: 'Selecione pelo menos a Filial para adicionar a regra.', type: 'warning' });
            }
        });
    },

    carregarSelectFiliais: function () {
        var that = this;
        $.ajax({
            url: '/api/public/ecm/dataset/datasets',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: "ds_irho_empresaFilial" // Seu dataset que lista as filiais
            }),
            success: function (res) {
                var select = $("#ADD_FILIAL_" + that.instanceId);
                select.empty(); // Limpa o "Carregando..."
                select.append('<option value="">Selecione uma Filial...</option>');

                if (res && res.content && res.content.values) {
                    res.content.values.forEach(function (item) {
                        // Resgata os dados mapeados no seu dataset
                        var idDesc = item.IDDESC_EMPRESAFILIAL;
                        var idEmp = item.ID_EMPRESA;
                        var idFil = item.ID_FILIAL;

                        if (idDesc && idEmp && idFil) {
                            // Salva os códigos no value separados por pipe "|" (ex: "1|1")
                            select.append('<option value="' + idEmp + '|' + idFil + '">' + idDesc + '</option>');
                        }
                    });
                }
            },
            error: function (err) {
                $("#ADD_FILIAL_" + that.instanceId).html('<option value="">Erro ao carregar</option>');
                console.error("Erro ao carregar filiais:", err);
            }
        });
    },

    carregarSelectBancos: function () {
        var that = this;
        $.ajax({
            url: '/api/public/ecm/dataset/datasets',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: "ds_irho_banco" // Seu dataset de bancos
            }),
            success: function (res) {
                var select = $("#ADD_BANCO_" + that.instanceId);
                select.empty(); // Limpa o "Carregando..."
                select.append('<option value="">Selecione um Banco...</option>');

                if (res && res.content && res.content.values) {
                    res.content.values.forEach(function (item) {
                        // O dataset já traz o CODIGO e o texto bonitinho no IDDESC_BANCO
                        var codigo = item.CODIGO;
                        var idDesc = item.IDDESC_BANCO;

                        // Se o banco tiver código válido e não for uma linha de erro
                        if (codigo && idDesc && item.ERROR === "") {
                            select.append('<option value="' + codigo + '">' + idDesc + '</option>');
                        }
                    });
                }
            },
            error: function (err) {
                $("#ADD_BANCO_" + that.instanceId).html('<option value="">Erro ao carregar</option>');
                console.error("Erro ao carregar bancos:", err);
            }
        });
    },

    carregarSelectAgencias: function (codigoBanco) {
        var that = this;
        var select = $("#ADD_AGENCIA_" + that.instanceId);

        select.empty().prop('disabled', true);

        if (!codigoBanco) {
            select.append('<option value="">Aguardando Banco...</option>');
            return;
        }

        select.append('<option value="">Carregando...</option>');

        $.ajax({
            url: '/api/public/ecm/dataset/datasets',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: "ds_irho_agenciasBanco",
                constraints: [{
                    "_field": "NUMBANCO",
                    "_initialValue": codigoBanco,
                    "_finalValue": codigoBanco,
                    "_type": 1 // MUST
                }]
            }),
            success: function (res) {
                select.empty().append('<option value="">Selecione a Agência...</option>');

                if (res && res.content && res.content.values) {
                    res.content.values.forEach(function (item) {
                        if (item.NUMAGENCIA && item.ERROR === "") {
                            select.append('<option value="' + item.NUMAGENCIA + '">' + item.IDDESC_AGENCIA + '</option>');
                        }
                    });
                    select.prop('disabled', false); // Libera o campo!
                }
            },
            error: function (err) {
                select.html('<option value="">Erro ao carregar</option>');
            }
        });
    },

    renderizarTabelaParametros: function () {
        var html = "";
        var that = this;

        for (var i = 0; i < this.parametrosFilial.length; i++) {
            var p = this.parametrosFilial[i];

            // Fallback: Se não tiver descrição carregada, mostra o código
            var displayFilial = p.descFilial ? p.descFilial : (p.empresa + " - " + p.filial);
            var displayBanco = p.descBanco ? p.descBanco : (p.banco || "-");
            var displayAgencia = p.descAgencia ? p.descAgencia : (p.agencia || "-");
            var displayPadt = p.padt ? p.padt + "%" : "-";

            html += "<tr>";
            html += "<td>" + p.empresa + "</td>";
            html += "<td>" + p.filial + " <small class='text-muted'>(" + displayFilial + ")</small></td>";
            html += "<td>" + displayBanco + "</td>";
            html += "<td>" + displayAgencia + "</td>";
            html += "<td>" + displayPadt + "</td>";
            html += "<td>";
            html += "<button type='button' class='btn btn-info btn-xs btn-edit-param' data-index='" + i + "' style='margin-right:5px;'><i class='flaticon flaticon-edit icon-sm'></i></button>";
            html += "<button type='button' class='btn btn-danger btn-xs btn-remove-param' data-index='" + i + "'><i class='flaticon flaticon-trash icon-sm'></i></button>";
            html += "</td>";
            html += "</tr>";
        }

        $("#tbl_parametros_" + this.instanceId + " tbody").html(html);

        // EVENTO: EDITAR
        $(".btn-edit-param").off('click').on('click', function () {
            var idx = $(this).data('index');
            var item = that.parametrosFilial[idx];

            // 1. Sobe os dados para os campos de preenchimento
            $("#ADD_FILIAL_" + that.instanceId).val(item.empresa + "|" + item.filial);
            $("#ADD_BANCO_" + that.instanceId).val(item.banco).trigger('change');

            // Timeout para dar tempo de carregar as agências do banco selecionado
            setTimeout(function () {
                $("#ADD_AGENCIA_" + that.instanceId).val(item.agencia);
            }, 1000);

            $("#ADD_PADT_" + that.instanceId).val(item.padt);

            // 2. Remove da lista temporariamente (ao clicar em Salvar ele volta como novo)
            that.parametrosFilial.splice(idx, 1);
            that.renderizarTabelaParametros();

            FLUIGC.toast({ title: 'Edição Ativada', message: 'Os dados foram carregados nos campos acima.', type: 'info' });
        });

        // EVENTO: REMOVER
        $(".btn-remove-param").off('click').on('click', function () {
            var idx = $(this).data('index');
            that.parametrosFilial.splice(idx, 1);
            that.renderizarTabelaParametros();
        });
    },

    bindings: {
        local: {
            'save-config': ['click_salvarConfiguracoes'],
            'new-config': ['click_abrirNovoFormulario'],
            'back-dashboard': ['click_voltarPainel']
        }
    },

    configurarEventosSenha: function () {
        var that = this;
        // Habilita o botão de editar apenas quando houver algo digitado na senha
        $("#pwd_acesso_" + this.instanceId).on('keyup', function () {
            var val = $(this).val();
            if (val && val.length > 0) {
                $("#btn_editar_config_" + that.instanceId).prop('disabled', false);
            } else {
                $("#btn_editar_config_" + that.instanceId).prop('disabled', true);
            }
        });

        // Força o bind direto com jQuery para evitar problemas do lifecycle do SuperWidget em botões disabled
        $("#btn_editar_config_" + this.instanceId).off('click').on('click', function (e) {
            e.preventDefault();
            that.verificarSenhaE_Editar();
        });
    },

    /**
     * Fluxo de Listagem e Cache em Memória
     * Busca os dados no Dataset e armazena no objeto this.itensEmMemoria
     */
    carregarDados: function () {
        var that = this;

        // Reset UI de Dashboard
        $("#status_icon_" + that.instanceId).html('<i class="flaticon flaticon-system-clock"></i>').css("color", "#ccc");
        $("#status_text_" + that.instanceId).text("Carregando dados...");
        $("#status_subtext_" + that.instanceId).text("Verificando se já existe uma configuração ativa neste servidor.");
        $("#btn_criar_config_" + that.instanceId).hide();
        $("#area_autenticacao_" + that.instanceId).hide();

        var url = WCMAPI.getServerURL() + '/api/public/ecm/dataset/datasets';

        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: "Form_Configuracoes_Admissao",
                constraints: [{
                    "_field": "metadata#active",
                    "_initialValue": "true",
                    "_finalValue": "true",
                    "_type": 1, // MUST
                    "_likeSearch": false
                }]
            }),
            success: function (res) {
                that.itensEmMemoria = {};
                var valores = res.content ? res.content.values : [];
                var qtdValidos = 0;

                if (valores && valores.length > 0) {
                    for (var i = 0; i < valores.length; i++) {
                        var item = valores[i];

                        if (item["metadata#active"] === false || item["metadata#active"] === "false") {
                            continue; // Pula registros inativos
                        }

                        var docId = item.documentid || item["metadata#id"];
                        if (!docId) continue;

                        that.itensEmMemoria[docId] = item;
                        qtdValidos++;
                    }
                }

                if (qtdValidos > 0) {
                    // JÁ EXISTE CONFIGURAÇÃO
                    $("#status_icon_" + that.instanceId).html('<i class="flaticon flaticon-check-circle-on"></i>').css("color", "#4caf50");
                    $("#status_text_" + that.instanceId).text("Configurações Encontradas");
                    $("#status_subtext_" + that.instanceId).text("1 registro ativo de configuração geral foi localizado.");

                    $("#area_autenticacao_" + that.instanceId).fadeIn();
                } else {
                    // NÃO EXISTE CONFIGURAÇÃO
                    $("#status_icon_" + that.instanceId).html('<i class="flaticon flaticon-warning-circle"></i>').css("color", "#ff9800");
                    $("#status_text_" + that.instanceId).text("Nenhuma Configuração Encontrada");
                    $("#status_subtext_" + that.instanceId).text("Você precisa criar o perfil de configuração interna.");

                    // Limpa id para garantir INSERT 
                    that.documentId = null;
                    if ($("#config_doc_id_" + that.instanceId).length > 0) {
                        $("#config_doc_id_" + that.instanceId).val('');
                    }

                    $("#btn_criar_config_" + that.instanceId).fadeIn();
                }
            },
            error: function (err) {
                console.error("Erro ao consultar dataset: ", err);
                $("#status_icon_" + that.instanceId).html('<i class="flaticon flaticon-close-circle"></i>').css("color", "#f44336");
                $("#status_text_" + that.instanceId).text("Erro de Conexão");
                $("#status_subtext_" + that.instanceId).text("Falha ao comunicar com os Datasets internos do Fluig.");
            }
        });
    },

    // --- NAVEGAÇÃO E AUTENTICAÇÃO ---

    abrirNovoFormulario: function () {
        // Zera os campos pro caso de ter sujeira
        $("#Widget_Configuracao_Admissao_" + this.instanceId + " input.form-control").val('');

        $("#view_dashboard_" + this.instanceId).hide();
        $("#view_formulario_" + this.instanceId).fadeIn();
    },

    voltarPainel: function () {
        $("#view_formulario_" + this.instanceId).hide();
        $("#view_dashboard_" + this.instanceId).fadeIn();
        // Limpa a senha por segurança
        $("#pwd_acesso_" + this.instanceId).val('');
        $("#btn_editar_config_" + this.instanceId).prop('disabled', true);
    },

    verificarSenhaE_Editar: function () {
        var that = this;
        var senhaDigitada = $("#pwd_acesso_" + this.instanceId).val();

        if (senhaDigitada !== this.SENHA_MESTRE) {
            FLUIGC.toast({ title: 'Acesso Negado', message: 'Senha incorreta.', type: 'danger' });
            return;
        }

        // Senha correta: pega a primeira config em memoria e preenche a tela
        var ids = Object.keys(that.itensEmMemoria);
        if (ids.length > 0) {
            that.preencherFormulario(ids[0]);

            $("#view_dashboard_" + this.instanceId).hide();
            $("#view_formulario_" + this.instanceId).fadeIn();
        } else {
            FLUIGC.toast({ title: 'Erro', message: 'Nenhuma configuração em memória para editar.', type: 'warning' });
        }
    },

    /**
     * Fluxo de Edição 
     */
    preencherFormulario: function (docId) {
        var that = this;
        var configDaMemoria = this.itensEmMemoria[docId];

        if (configDaMemoria) {
            that.documentId = docId;
            if ($("#config_doc_id_" + that.instanceId).length > 0) {
                $("#config_doc_id_" + that.instanceId).val(docId);
            }

            var camposForm = [
                "FLUIG_SOAP_USER", "FLUIG_SOAP_PASS", "RM_USER", "RM_PASS", "RM_ENDPOINT_WS",
                "FLUIG_OAUTH_CONSUMER_KEY", "FLUIG_OAUTH_CONSUMER_SECRET",
                "FLUIG_OAUTH_TOKEN", "FLUIG_OAUTH_TOKEN_SECRET",
                "URL_PAGINA_CANDIDATO", "URL_PAGINA_CORRECAO", "URL_PAGINA_ASSINATURA",
                "FLUIG_TENANT_ID", "ID_PASTA_FORMULARIO", "URL_BASE_TAE",
                "FLUIG_PROCESS_ID_ADMISSAO", "ATIVIDADE_CANDIDATO_DADOS", "ATIVIDADE_CANDIDATO_CORRECAO", "ATIVIDADE_CANDIDATO_ASSINATURA",
                "TAE_USER", "TAE_PASS", "ATIVIDADE_RH_CONCLUSAO", "ID_PASTA_RAIZ_CANDIDATOS"
            ];

            camposForm.forEach(function (campo) {
                if (configDaMemoria[campo]) {
                    $("#" + campo + "_" + that.instanceId).val(configDaMemoria[campo]);
                }
            });

            // LIMPA A TABELA E BUSCA OS FILHOS (TABELA PAI X FILHO)
            that.parametrosFilial = [];
            that.renderizarTabelaParametros();

            $.ajax({
                url: WCMAPI.getServerURL() + '/api/public/ecm/dataset/datasets',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    name: "Form_Configuracoes_Admissao",
                    constraints: [
                        { "_field": "tablename", "_initialValue": "tbParametrosFilial", "_finalValue": "tbParametrosFilial", "_type": 1 },
                        { "_field": "metadata#id", "_initialValue": docId, "_finalValue": docId, "_type": 1 }
                    ]
                }),
                success: function (res) {
                    if (res && res.content && res.content.values) {
                        res.content.values.forEach(function (item) {
                            // Criamos o objeto básico com os códigos salvos
                            var row = {
                                empresa: item.PARAM_COD_EMPRESA,
                                filial: item.PARAM_COD_FILIAL,
                                banco: item.PARAM_BANCO,
                                agencia: item.PARAM_AGENCIA,
                                padt: item.PARAM_PADT,
                                descFilial: "", // Será preenchido na renderização ou via novo fetch
                                descBanco: "",
                                descAgencia: ""
                            };
                            that.parametrosFilial.push(row);
                        });
                        that.renderizarTabelaParametros();
                    }
                }
            });
        }
    },

    /**
     * Fluxo de Gravação (Estratégia Delete + Create)
     */
    salvarConfiguracoes: function () {
        var that = this;
        var hiddenVal = $("#config_doc_id_" + that.instanceId).val();
        var idDocumento = hiddenVal ? hiddenVal : that.documentId;

        var camposForm = [
            "FLUIG_SOAP_USER", "FLUIG_SOAP_PASS",
            "RM_USER", "RM_PASS", "RM_ENDPOINT_WS",
            "FLUIG_OAUTH_CONSUMER_KEY", "FLUIG_OAUTH_CONSUMER_SECRET",
            "FLUIG_OAUTH_TOKEN", "FLUIG_OAUTH_TOKEN_SECRET",
            "URL_PAGINA_CANDIDATO", "URL_PAGINA_CORRECAO", "URL_PAGINA_ASSINATURA",
            "FLUIG_TENANT_ID", "ID_PASTA_FORMULARIO", "URL_BASE_TAE",
            "FLUIG_PROCESS_ID_ADMISSAO", "ATIVIDADE_CANDIDATO_DADOS", "ATIVIDADE_CANDIDATO_CORRECAO", "ATIVIDADE_CANDIDATO_ASSINATURA",
            "TAE_USER", "TAE_PASS", "ATIVIDADE_RH_CONCLUSAO", "ID_PASTA_RAIZ_CANDIDATOS"
        ];

        var formData = [];

        // 1. Grava os campos normais
        camposForm.forEach(function (campo) {
            formData.push({
                "name": campo,
                "value": String($("#" + campo + "_" + that.instanceId).val() || '')
            });
        });

        // 2. Grava a tabela Pai x Filho
        var index = 1;
        this.parametrosFilial.forEach(function (param) {
            formData.push({ "name": "PARAM_COD_EMPRESA___" + index, "value": param.empresa });
            formData.push({ "name": "PARAM_COD_FILIAL___" + index, "value": param.filial });
            formData.push({ "name": "PARAM_BANCO___" + index, "value": param.banco });
            formData.push({ "name": "PARAM_AGENCIA___" + index, "value": param.agencia });
            formData.push({ "name": "PARAM_PADT___" + index, "value": param.padt });
            index++;
        });

        // Lê o ID da pasta do formulário do campo oculto, se não tiver usa o default
        var pastaIdStr = $("#ID_PASTA_FORMULARIO_" + that.instanceId).val();
        var pastaDestino = pastaIdStr ? parseInt(pastaIdStr) : 3483; // Lê do ecrã, se vazio usa a 3483

        // Prepara o pacote JSON para a API de Cards do Fluig
        var pacoteJSON = {
            "documentDescription": "ConfigAdmissao_Registro_" + new Date().getTime(),
            "version": 1000,
            "parentDocumentId": pastaDestino,
            "inheritSecurity": true,
            "formData": formData
        };

        var loading = FLUIGC.loading(window);
        loading.show();

        if (idDocumento) {
            $.ajax({
                url: '/api/public/2.0/documents/deleteDocument/' + idDocumento,
                type: 'POST',
                success: function () {
                    that.gravarNovaConfiguracao(pacoteJSON, loading);
                },
                error: function (err) {
                    console.warn("Aviso ao tentar excluir o card antigo.", err);
                    that.gravarNovaConfiguracao(pacoteJSON, loading);
                }
            });
        } else {
            that.gravarNovaConfiguracao(pacoteJSON, loading);
        }
    },

    /**
     * Função Auxiliar para criar o Card físico após limpeza
     */
    gravarNovaConfiguracao: function (pacoteJSON, loading) {
        var that = this;
        $.ajax({
            url: '/api/public/2.0/cards/create',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(pacoteJSON),
            success: function (res) {
                loading.hide();
                FLUIGC.toast({ title: 'Sucesso', message: 'Dados salvos corretamente!', type: 'success' });

                // Limpa variáveis e cache
                that.documentId = null;
                $("#config_doc_id_" + that.instanceId).val('');

                // Volta para o dashboard e recarrega os status
                that.voltarPainel();
                setTimeout(function () {
                    that.carregarDados();
                }, 1000);
            },
            error: function (err) {
                loading.hide();
                console.error("Erro na API Cards Fluig:", err);
                FLUIGC.toast({ title: 'Erro Upsert', message: 'Houve falha na gravação.', type: 'danger' });
            }
        });
    }
});
