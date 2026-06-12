var Widget_Configuracao_Admissao = SuperWidget.extend({
    instanceId: null,
    documentId: null, // Mantém backup em memória caso o HTML com hidden cacheie
    itensEmMemoria: {},
    ID_PASTA_FORMULARIO: 17765,
    SENHA_MESTRE: 'mb2026', // Defina a senha desejada aqui
    parametrosFilial: [],
    jornadasAdmissao: [],
    camposJornadaAdmissao: [],
    catalogoCamposJornada: [],
    coligadasDisponiveis: [],
    opcoesDatasetCache: {},
    jornadaCodigoEmEdicao: null,
    jornadaColigadasEmEdicao: null,

    init: function () {
        this.carregarDados();
        this.configurarEventosSenha();
        this.carregarSelectFiliais();
        this.carregarSelectBancos();
        this.inicializarCatalogoCamposJornada();
        this.carregarColigadasJornada();
        this.renderizarPaineisJornadaCampos();

        var that = this;
        $("#btn_add_jornada_" + this.instanceId).off('click').on('click', function () {
            var codigo = that.normalizarCodigoJornada($("#ADD_JORNADA_CODIGO_" + that.instanceId).val());
            var descricao = $.trim($("#ADD_JORNADA_DESCRICAO_" + that.instanceId).val() || "");

            if (!codigo) {
                FLUIGC.toast({ title: 'Atencao:', message: 'Informe o codigo da jornada.', type: 'warning' });
                return;
            }

            if (!descricao) {
                FLUIGC.toast({ title: 'Atencao:', message: 'Informe a descricao da jornada.', type: 'warning' });
                return;
            }

            var codigoChave = that.chaveCodigoJornada(codigo);
            var duplicado = false;
            for (var i = 0; i < that.jornadasAdmissao.length; i++) {
                if (that.chaveCodigoJornada(that.jornadasAdmissao[i].codigo) === codigoChave) {
                    duplicado = true;
                    break;
                }
            }

            if (duplicado) {
                FLUIGC.toast({ title: 'Operacao Bloqueada: ', message: 'Ja existe uma jornada com este codigo.', type: 'danger' });
                return;
            }

            that.jornadasAdmissao.push({
                codigo: codigo,
                descricao: descricao,
                coligadas: that.jornadaColigadasEmEdicao || "*",
                ativo: "S",
                ordem: ""
            });

            if (that.jornadaCodigoEmEdicao && that.jornadaCodigoEmEdicao !== codigo) {
                for (var f = 0; f < that.camposJornadaAdmissao.length; f++) {
                    if (that.chaveCodigoJornada(that.camposJornadaAdmissao[f].jornadaCodigo) === that.chaveCodigoJornada(that.jornadaCodigoEmEdicao)) {
                        that.camposJornadaAdmissao[f].jornadaCodigo = codigo;
                        that.camposJornadaAdmissao[f].jsonExtra = that.atualizarJsonExtraCampoJornada(that.camposJornadaAdmissao[f]);
                    }
                }
                that.renderizarTabelaCamposJornada();
            }
            that.jornadaCodigoEmEdicao = null;
            that.jornadaColigadasEmEdicao = null;

            that.renderizarTabelaJornadas();
            that.renderizarPaineisJornadaCampos();

            $("#ADD_JORNADA_CODIGO_" + that.instanceId).val('');
            $("#ADD_JORNADA_DESCRICAO_" + that.instanceId).val('');
        });

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

    inicializarCatalogoCamposJornada: function () {
        this.catalogoCamposJornada = [
            {
                id: "cpTipoContrato",
                label: "Tipo de Contrato",
                tipo: "select",
                opcoes: [
                    { valor: "Individual", texto: "Contrato individual de trabalho" },
                    { valor: "TCE", texto: "TCE - Termo de compromisso de estagio" }
                ]
            },
            {
                id: "cpContratoPrazo",
                label: "Contrato com Prazo",
                tipo: "select",
                opcoes: [
                    { valor: "indeterminado", texto: "Prazo Indeterminado" },
                    { valor: "determinado", texto: "Prazo Determinado" },
                    { valor: "experiencia", texto: "Experiencia" }
                ]
            },
            {
                id: "zoomTipoFuncionario",
                label: "Tipo Funcionario",
                tipo: "zoom",
                datasetId: "ds_irho_tipoFuncionario",
                valueField: "CODIGO",
                textField: "TIPO_FUNCIONARIO",
                hiddenFields: [
                    {
                        id: "codTipoFuncionario",
                        field: "CODIGO"
                    }
                ]
            },
            {
                id: "zoom_categoriaEsocial",
                label: "Categoria eSocial",
                tipo: "zoom",
                datasetId: "ds_irho_categoriaEsocial",
                valueField: "IDDESC_CATEGORIAESOCIAL",
                textField: "IDDESC_CATEGORIAESOCIAL",
                hiddenFields: [
                    {
                        id: "FUN_CATESOCIAL",
                        field: "CODIGO"
                    }
                ]
            },
            {
                id: "FUN_IDDESCFUN",
                label: "Funcao",
                tipo: "zoom",
                datasetId: "ds_irho_funcao",
                valueField: "CODIGO",
                textField: "IDDESC_FUNCAO"
            },
            {
                id: "FUN_IDDESCTURN",
                label: "Turno de Trabalho",
                tipo: "zoom",
                datasetId: "ds_irho_turnoTrabalho",
                valueField: "CODIGO",
                textField: "IDDESC_HORARIO"
            },
            {
                id: "FUN_SEQTURN_IDDESC_AD",
                label: "Sequencia do Turno",
                tipo: "zoom",
                datasetId: "ds_irho_seqTurno",
                valueField: "INDINICIOHOR",
                textField: "INDINICIOHOR",
                hiddenFields: [
                    {
                        id: "FUN_SEQTURN",
                        field: "INDINICIOHOR"
                    },
                    {
                        id: "FUN_SEQTURN_DESC_AD",
                        field: "INDINICIOHOR"
                    }
                ],
                dependeDe: [
                    {
                        campoId: "FUN_IDDESCTURN",
                        constraintField: "CODHORARIO",
                        label: "Turno de Trabalho"
                    }
                ],
                usaColigadaJornada: true,
                coligadaConstraintField: "ID_EMPRESA"
            },
            {
                id: "FUN_TIPOPGTO_IDDESC_AD",
                label: "Tipo de Recebimento",
                tipo: "zoom",
                datasetId: "ds_irho_codRecebimento",
                valueField: "CODCLIENTE",
                textField: "IDDESC_TIPORECEBIMENTO",
                hiddenFields: [
                    {
                        id: "FUN_TIPOPGTO",
                        field: "CODCLIENTE"
                    },
                    {
                        id: "FUN_TIPOPGTO_DESC_AD",
                        field: "DESCRICAO"
                    }
                ]
            },
            {
                id: "FUN_TPJORNADA",
                label: "Tipo de Jornada",
                tipo: "select",
                opcoes: [
                    { valor: "1", texto: "Submetidos a Horario" },
                    { valor: "2", texto: "Atividade Externa" },
                    { valor: "3", texto: "Funcoes Especificadas" },
                    { valor: "4", texto: "Teletrabalho" }
                ]
            },
            {
                id: "cpQtdHorasMes",
                label: "Jornada Mensal",
                tipo: "texto"
            },
            {
                id: "FUN_VLRSALARIO",
                label: "Salario",
                tipo: "moeda"
            },
            {
                id: "FUN_ALTFGTS",
                label: "FGTS",
                tipo: "select",
                opcoes: [
                    { valor: "1", texto: "1 - Optante" },
                    { valor: "2", texto: "2 - Nao Optante" }
                ]
            },
            {
                id: "cpRegimePrevidenciario",
                label: "Regime Previdenciario",
                tipo: "select",
                opcoes: [
                    { valor: "1", texto: "RGPS" },
                    { valor: "2", texto: "RPPS" },
                    { valor: "3", texto: "Exterior" }
                ]
            },
            {
                id: "zoom_sindicato",
                label: "Sindicato",
                tipo: "zoom",
                datasetId: "ds_irho_sindicato",
                valueField: "CODIGO",
                textField: "IDDESC_SINDICATO",
                hiddenFields: [
                    {
                        id: "cod_sindicato",
                        field: "CODIGO"
                    }
                ],
                usaColigadaJornada: true,
                coligadaConstraintField: "ID_EMPRESA"
            },
            {
                id: "zoom_sindicato_filiacao",
                label: "Sindicato Filiacao",
                tipo: "zoom",
                datasetId: "ds_irho_sindicato",
                valueField: "CODIGO",
                textField: "IDDESC_SINDICATO",
                hiddenFields: [
                    {
                        id: "FUN_CODDESCSINDICATOFILIACAO",
                        field: "CODIGO"
                    }
                ],
                usaColigadaJornada: true,
                coligadaConstraintField: "ID_EMPRESA"
            },
            {
                id: "zoom_ocorrencia_sefip",
                label: "Ocorrencia SEFIP",
                tipo: "zoom",
                datasetId: "ds_IRHO_codOcorrenciaSefip",
                valueField: "IDDESC_OCORRENCIA",
                textField: "IDDESC_OCORRENCIA",
                hiddenFields: [
                    {
                        id: "FUN_CODOCORRENCIA_IDDESC",
                        field: "IDDESC_OCORRENCIA"
                    }
                ]
            },
            {
                id: "zoom_categoria_sefip",
                label: "Categoria SEFIP",
                tipo: "zoom",
                datasetId: "ds_irho_codCategoriaSefip",
                valueField: "IDDESC_CATSEFIP",
                textField: "IDDESC_CATSEFIP",
                hiddenFields: [
                    {
                        id: "FUN_CATSEFIP_IDDESC",
                        field: "IDDESC_CATSEFIP"
                    }
                ]
            },
            {
                id: "zoom_situacao_rais",
                label: "Situacao RAIS",
                tipo: "zoom",
                datasetId: "ds_irho_situacaoRais",
                valueField: "COD_SITUACAO",
                textField: "IDDESC_SITUACAO",
                hiddenFields: [
                    {
                        id: "cpSituacaoRais",
                        field: "COD_SITUACAO"
                    }
                ]
            },
            {
                id: "zoom_vinculo_rais",
                label: "Vinculo RAIS",
                tipo: "zoom",
                datasetId: "ds_irho_vinculoRais",
                valueField: "CODCLIENTE",
                textField: "IDDESC_VINCULO",
                hiddenFields: [
                    {
                        id: "FUN_VINCEMPREG",
                        field: "CODCLIENTE"
                    },
                    {
                        id: "FUN_VINCEMPREG_IDDESC_AD",
                        field: "IDDESC_VINCULO"
                    }
                ]
            },
            {
                id: "MarcaPonto",
                label: "Marca Ponto",
                tipo: "select",
                opcoes: [
                    { valor: "1", texto: "Sim" },
                    { valor: "2", texto: "Nao" }
                ]
            },
            {
                id: "ContSalBrad",
                label: "Conta Salario",
                tipo: "select",
                opcoes: [
                    { valor: "1", texto: "Sim" },
                    { valor: "2", texto: "Nao" }
                ]
            }
        ];

        this.atualizarSelectCamposJornada();
    },

    obterCampoDoCatalogo: function (campoId) {
        for (var i = 0; i < this.catalogoCamposJornada.length; i++) {
            if (this.catalogoCamposJornada[i].id === campoId) {
                return this.catalogoCamposJornada[i];
            }
        }
        return null;
    },

    atualizarSelectCamposJornada: function () {
        var select = $("#ADD_CJ_CAMPO_ID_" + this.instanceId);
        if (!select.length) {
            return;
        }

        var valorAtual = select.val();
        select.empty();
        select.append('<option value="">Selecione</option>');

        for (var i = 0; i < this.catalogoCamposJornada.length; i++) {
            var campo = this.catalogoCamposJornada[i];
            select.append('<option value="' + this.escapeHtml(campo.id) + '">' + this.escapeHtml(campo.label) + ' (' + this.escapeHtml(campo.tipo) + ')</option>');
        }

        if (valorAtual) {
            select.val(valorAtual);
        }
    },

    atualizarSelectJornadasCampos: function () {
        var select = $("#ADD_CJ_JORNADA_CODIGO_" + this.instanceId);
        if (!select.length) {
            return;
        }

        var valorAtual = select.val();
        select.empty();
        select.append('<option value="">Selecione</option>');

        for (var i = 0; i < this.jornadasAdmissao.length; i++) {
            var jornada = this.jornadasAdmissao[i];
            var texto = jornada.codigo;
            if (jornada.descricao) {
                texto += ' - ' + jornada.descricao;
            }
            select.append('<option value="' + this.escapeHtml(jornada.codigo) + '">' + this.escapeHtml(texto) + '</option>');
        }

        if (valorAtual) {
            select.val(valorAtual);
        }
    },

    carregarColigadasJornada: function () {
        var that = this;
        that.coligadasDisponiveis = [
            { id: "*", texto: "Todas" }
        ];

        try {
            $.ajax({
                url: '/api/public/ecm/dataset/datasets',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    name: "ds_irho_empresaFilial"
                }),
                success: function (res) {
                    try {
                        var itens = res && res.content && res.content.values ? res.content.values : [];
                        var empresas = {};

                        for (var i = 0; i < itens.length; i++) {
                            var item = itens[i];
                            var idEmp = item.ID_EMPRESA;
                            if (!idEmp || empresas[idEmp]) {
                                continue;
                            }

                            var nomeEmpresa = item.NOMECOMERCIAL || item.EMPRESA || item.NOME_EMPRESA || item.IDDESC_EMPRESAFILIAL || idEmp;
                            empresas[idEmp] = true;
                            that.coligadasDisponiveis.push({
                                id: String(idEmp),
                                texto: String(idEmp) + ' - ' + String(nomeEmpresa)
                            });
                        }
                        that.renderizarTodasColigadasDosPaineis();
                    } catch (e) {
                        console.warn('Erro ao montar coligadas da jornada.', e);
                    }
                },
                error: function (err) {
                    console.warn('Falha ao carregar coligadas da jornada.', err);
                    that.renderizarTodasColigadasDosPaineis();
                }
            });
        } catch (e2) {
            console.warn('Falha ao iniciar carregamento de coligadas.', e2);
            that.renderizarTodasColigadasDosPaineis();
        }
    },

    normalizarColigadasJornada: function (valor) {
        if (!valor) {
            return ["*"];
        }

        var lista = [];

        if ($.isArray(valor)) {
            lista = valor;
        } else {
            lista = String(valor).split(",");
        }

        var resultado = [];

        for (var i = 0; i < lista.length; i++) {
            var item = $.trim(String(lista[i] || ""));

            if (!item) {
                continue;
            }

            if (item === "*") {
                return ["*"];
            }

            if (resultado.indexOf(item) === -1) {
                resultado.push(item);
            }
        }

        return resultado.length ? resultado : ["*"];
    },

    obterTextoColigada: function (idColigada) {
        var id = String(idColigada || "");

        if (id === "*") {
            return "Todas";
        }

        for (var i = 0; i < this.coligadasDisponiveis.length; i++) {
            if (String(this.coligadasDisponiveis[i].id) === id) {
                return this.coligadasDisponiveis[i].texto;
            }
        }

        return id;
    },

    montarOptionsColigadasDisponiveis: function (selecionadas) {
        var html = '<option value="">Selecione uma coligada...</option>';
        var selecionadasNorm = this.normalizarColigadasJornada(selecionadas);

        html += '<option value="*">Todas</option>';

        for (var i = 0; i < this.coligadasDisponiveis.length; i++) {
            var coligada = this.coligadasDisponiveis[i];
            var id = String(coligada.id);

            if (id === "*") {
                continue;
            }

            if (selecionadasNorm.indexOf(id) !== -1) {
                continue;
            }

            html += '<option value="' + this.escapeHtml(id) + '">' + this.escapeHtml(coligada.texto) + '</option>';
        }

        return html;
    },

    renderizarColigadasSelecionadasWrapper: function ($wrapper) {
        if (!$wrapper || !$wrapper.length) {
            return;
        }

        var valor = $wrapper.find(".jornada-coligadas").val();
        var selecionadas = this.normalizarColigadasJornada(valor);
        var valorFinal = selecionadas.indexOf("*") !== -1 ? "*" : selecionadas.join(",");
        var html = "";

        for (var i = 0; i < selecionadas.length; i++) {
            var id = selecionadas[i];
            var texto = this.obterTextoColigada(id);

            html += '<span class="label label-info" style="display:inline-block; margin:3px; padding:7px 9px;">';
            html += this.escapeHtml(texto);

            if (id !== "*") {
                html += ' <button type="button" class="btn-remove-coligada-jornada" data-coligada="' + this.escapeHtml(id) + '" style="border:0;background:transparent;color:#fff;margin-left:6px;font-weight:bold;">&times;</button>';
            }

            html += '</span>';
        }

        $wrapper.find(".jornada-coligadas").val(valorFinal);
        $wrapper.find(".coligadas-selecionadas").html(html || '<span class="text-muted">Todas</span>');
        $wrapper.find(".jornada-coligada-disponivel").html(this.montarOptionsColigadasDisponiveis(selecionadas));

        if (valorFinal === "*") {
            $wrapper.find(".jornada-coligada-disponivel").val("*");
        } else {
            $wrapper.find(".jornada-coligada-disponivel").val("");
        }
    },

    renderizarTodasColigadasDosPaineis: function () {
        var that = this;

        $("#container_paineis_jornada_" + this.instanceId + " .coligadas-jornada-wrapper").each(function () {
            that.renderizarColigadasSelecionadasWrapper($(this));
        });
    },

    obterCampoParametrizado: function (jornadaCodigo, campoId) {
        var chaveJornada = this.chaveCodigoJornada(jornadaCodigo);

        for (var i = 0; i < this.camposJornadaAdmissao.length; i++) {
            var item = this.camposJornadaAdmissao[i];

            if (
                this.chaveCodigoJornada(item.jornadaCodigo) === chaveJornada &&
                item.campoId === campoId
            ) {
                return item;
            }
        }

        return null;
    },

    obterValorCampoNoPainelJornada: function ($campoAtual, campoIdReferencia) {
        if (!$campoAtual || !$campoAtual.length || !campoIdReferencia) {
            return "";
        }

        var $painel = $campoAtual.closest(".painel-param-jornada");

        if (!$painel.length) {
            return "";
        }

        var $linhaReferencia = $painel.find('tr[data-campo-id="' + campoIdReferencia + '"]').first();

        if (!$linhaReferencia.length) {
            return "";
        }

        var $campoReferencia = $linhaReferencia.find(".campo-jornada-valor").first();

        if (!$campoReferencia.length) {
            return "";
        }

        var valor = $campoReferencia.val();

        if (valor === undefined || valor === null || valor === "") {
            valor = $campoReferencia.attr("data-valor-atual") || "";
        }

        if ($.isArray(valor)) {
            valor = valor.length ? valor[0] : "";
        }

        return $.trim(String(valor || ""));
    },

    obterColigadaBaseDoPainelJornada: function ($campoAtual) {
        if (!$campoAtual || !$campoAtual.length) {
            return "";
        }

        var $painel = $campoAtual.closest(".painel-param-jornada");

        if (!$painel.length) {
            return "";
        }

        var $selectColigadas = $painel.find(".jornada-coligadas").first();

        if (!$selectColigadas.length) {
            return "";
        }

        var valorColigada = $selectColigadas.val();
        var coligadas = [];

        if ($.isArray(valorColigada)) {
            coligadas = valorColigada;
        } else if (typeof valorColigada === "string" && valorColigada.indexOf(",") >= 0) {
            coligadas = valorColigada.split(",");
        } else if (valorColigada !== undefined && valorColigada !== null) {
            coligadas = [valorColigada];
        }

        for (var i = 0; i < coligadas.length; i++) {
            var item = $.trim(String(coligadas[i] || ""));

            if (item && item !== "*") {
                return item;
            }
        }

        return "";
    },

    resolverValorItemZoom: function (item, valueField) {
        if (!item || !valueField) {
            return "";
        }

        var chaves = [
            valueField,
            String(valueField).toUpperCase(),
            String(valueField).toLowerCase()
        ];

        for (var i = 0; i < chaves.length; i++) {
            var chave = chaves[i];

            if (item[chave] !== undefined && item[chave] !== null && item[chave] !== "") {
                return item[chave];
            }
        }

        return "";
    },

    resolverTextoItemZoom: function (item, textField, valorItem) {
        if (!item) {
            return valorItem;
        }

        var chaves = [
            textField,
            String(textField || "").toUpperCase(),
            String(textField || "").toLowerCase()
        ];

        for (var i = 0; i < chaves.length; i++) {
            var chave = chaves[i];

            if (chave && item[chave] !== undefined && item[chave] !== null && item[chave] !== "") {
                return item[chave];
            }
        }

        return valorItem;
    },

    montarChaveCacheZoom: function (datasetId, constraints) {
        return String(datasetId || "") + "::" + JSON.stringify(constraints || []);
    },

    limparSelectZoomCampo: function ($select, mensagem, valorPreservado) {
        if (!$select || !$select.length) {
            return;
        }

        var valor = $.trim(String(valorPreservado || ""));
        var html = "";

        if (valor) {
            html += '<option value="' + this.escapeHtml(valor) + '" selected="selected">' + this.escapeHtml(valor) + '</option>';
        }

        html += '<option value="">' + this.escapeHtml(mensagem || "Clique para carregar...") + '</option>';

        $select.attr("data-loaded", "false");
        $select.removeAttr("data-loading");
        $select.html(html);

        if (valor) {
            $select.val(valor);
            $select.attr("data-valor-atual", valor);
        } else {
            $select.attr("data-valor-atual", "");
        }
    },

    limparCamposZoomDependentesDoCampo: function ($campoAtual, campoIdAlterado, ehColigada) {
        if (!$campoAtual || !$campoAtual.length) {
            return;
        }

        var $painel = $campoAtual.closest(".painel-param-jornada");

        if (!$painel.length) {
            return;
        }

        var that = this;

        $painel.find(".campo-jornada-zoom[data-campo-id]").each(function () {
            var $select = $(this);
            var campoIdZoom = $.trim($select.attr("data-campo-id") || "");
            var campoZoom = that.obterCampoDoCatalogo(campoIdZoom);

            if (!campoZoom) {
                return;
            }

            var deveLimpar = false;
            var dependeDe = campoZoom.dependeDe || [];

            if (ehColigada && campoZoom.usaColigadaJornada) {
                deveLimpar = true;
            }

            for (var i = 0; i < dependeDe.length && !deveLimpar; i++) {
                var dependencia = dependeDe[i] || {};

                if (String(dependencia.campoId || "") === String(campoIdAlterado || "")) {
                    deveLimpar = true;
                }
            }

            if (deveLimpar) {
                that.limparSelectZoomCampo($select, "Clique para carregar...");
            }
        });
    },

    atualizarJsonExtraCampoJornada: function (campoPayload, campoCatalogo) {
        var catalogo = campoCatalogo || this.obterCampoDoCatalogo(campoPayload.campoId);
        return JSON.stringify({
            datasetId: catalogo && catalogo.datasetId ? catalogo.datasetId : "",
            campoId: catalogo && catalogo.id ? catalogo.id : (campoPayload ? campoPayload.campoId : ""),
            valueField: catalogo && catalogo.valueField ? catalogo.valueField : "",
            textField: catalogo && catalogo.textField ? catalogo.textField : "",
            hiddenFields: catalogo && catalogo.hiddenFields ? catalogo.hiddenFields : [],
            dependeDe: catalogo && catalogo.dependeDe ? catalogo.dependeDe : [],
            usaColigadaJornada: catalogo && catalogo.usaColigadaJornada ? true : false,
            coligadaConstraintField: catalogo && catalogo.coligadaConstraintField ? catalogo.coligadaConstraintField : ""
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

    normalizarCodigoJornada: function (valor) {
        var codigo = $.trim(String(valor || ""));
        codigo = codigo.replace(/\s+/g, "");

        try {
            codigo = codigo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {}

        if (codigo.toUpperCase() === "CLT") {
            return "CLT";
        }

        if (codigo.toLowerCase() === "estagio") {
            return "Estagio";
        }

        return codigo;
    },

    chaveCodigoJornada: function (valor) {
        return this.normalizarCodigoJornada(valor).toLowerCase();
    },

    escapeHtml: function (valor) {
        if (valor === null || valor === undefined) {
            return "";
        }
        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    escaparHtml: function (valor) {
        return this.escapeHtml(valor);
    },

    inicializarJornadasPadrao: function () {
        if (this.jornadasAdmissao && this.jornadasAdmissao.length > 0) {
            this.renderizarTabelaJornadas();
            this.renderizarPaineisJornadaCampos();
            return;
        }

        this.jornadasAdmissao = [
            {
                codigo: "ASSOCIADO",
                descricao: "Associado",
                coligadas: "2,3,10,11,15,16",
                ativo: "S",
                ordem: ""
            },
            {
                codigo: "CLT_COM_CONTROLE",
                descricao: "CLT - Com Controle de Jornada",
                coligadas: "1,9",
                ativo: "S",
                ordem: ""
            },
            {
                codigo: "CLT_SEM_CONTROLE",
                descricao: "CLT - Sem Controle de Jornada",
                coligadas: "1,9",
                ativo: "S",
                ordem: ""
            },
            {
                codigo: "CLT_RECEPCAO",
                descricao: "CLT - Recepcao",
                coligadas: "1,9",
                ativo: "S",
                ordem: ""
            },
            {
                codigo: "ESTAGIARIO",
                descricao: "Estagiario",
                coligadas: "*",
                ativo: "S",
                ordem: ""
            },
            {
                codigo: "JOVEM_APRENDIZ",
                descricao: "Jovem Aprendiz",
                coligadas: "*",
                ativo: "S",
                ordem: ""
            }
        ];

        this.renderizarTabelaJornadas();
        this.renderizarPaineisJornadaCampos();
        this.atualizarSelectJornadasCampos();
    },

    renderizarTabelaJornadas: function () {
        var html = "";
        var that = this;
        var jornadasOrdenadas = (this.jornadasAdmissao || []).slice(0);

        for (var i = 0; i < jornadasOrdenadas.length; i++) {
            var j = jornadasOrdenadas[i];
            var descricao = j.descricao ? that.escapeHtml(j.descricao) : "-";

            html += "<tr>";
            html += "<td>" + that.escapeHtml(j.codigo) + "</td>";
            html += "<td>" + descricao + "</td>";
            html += "<td>";
            html += "<button type='button' class='btn btn-info btn-xs btn-edit-jornada' data-index='" + i + "' style='margin-right:5px;'><i class='flaticon flaticon-edit icon-sm'></i></button>";
            html += "<button type='button' class='btn btn-danger btn-xs btn-remove-jornada' data-index='" + i + "'><i class='flaticon flaticon-trash icon-sm'></i></button>";
            html += "</td>";
            html += "</tr>";
        }

        $("#tbl_jornadas_" + this.instanceId + " tbody").html(html);

        $(".btn-edit-jornada").off('click').on('click', function () {
            var idx = $(this).data('index');
            var item = jornadasOrdenadas[idx];

            $("#ADD_JORNADA_CODIGO_" + that.instanceId).val(item.codigo);
            $("#ADD_JORNADA_DESCRICAO_" + that.instanceId).val(item.descricao);

            var chaveEditar = that.chaveCodigoJornada(item.codigo);
            that.jornadaCodigoEmEdicao = item.codigo;
            that.jornadaColigadasEmEdicao = item.coligadas || "*";
            that.jornadasAdmissao = that.jornadasAdmissao.filter(function (registro) {
                return that.chaveCodigoJornada(registro.codigo) !== chaveEditar;
            });
            that.renderizarTabelaJornadas();
            that.renderizarPaineisJornadaCampos();
        });

        $(".btn-remove-jornada").off('click').on('click', function () {
            var idx = $(this).data('index');
            var item = jornadasOrdenadas[idx];
            if (item && item.codigo) {
                var chaveRemover = that.chaveCodigoJornada(item.codigo);
                var listaFiltrada = [];
                for (var c = 0; c < that.camposJornadaAdmissao.length; c++) {
                    if (that.chaveCodigoJornada(that.camposJornadaAdmissao[c].jornadaCodigo) !== chaveRemover) {
                        listaFiltrada.push(that.camposJornadaAdmissao[c]);
                    }
                }
                that.camposJornadaAdmissao = listaFiltrada;
                that.jornadasAdmissao = that.jornadasAdmissao.filter(function (registro) {
                    return that.chaveCodigoJornada(registro.codigo) !== chaveRemover;
                });
            }
            that.renderizarTabelaJornadas();
            that.renderizarPaineisJornadaCampos();
        });

        that.atualizarSelectJornadasCampos();
    },

    renderizarPaineisJornadaCampos: function () {
        var that = this;
        var $container = $("#container_paineis_jornada_" + this.instanceId);

        if (!$container.length) {
            return;
        }

        var jornadasOrdenadas = (this.jornadasAdmissao || []).slice(0);

        if (!jornadasOrdenadas.length) {
            $container.html('<p class="text-muted">Cadastre uma jornada acima para parametrizar os campos.</p>');
            this.vincularEventosPaineisJornada();
            return;
        }

        var html = "";

        for (var i = 0; i < jornadasOrdenadas.length; i++) {
            var jornada = jornadasOrdenadas[i];
            var codigo = jornada.codigo || "";

            html += '<div class="panel panel-default painel-param-jornada" data-jornada="' + that.escapeHtml(codigo) + '">';
            html += '<div class="panel-heading painel-jornada-toggle" data-jornada="' + that.escapeHtml(codigo) + '" style="cursor:pointer;">';
            html += '<h3 class="panel-title">';
            html += that.escapeHtml((jornada.codigo || 'Jornada') + (jornada.descricao ? ' - ' + jornada.descricao : ''));
            html += ' <span class="pull-right"><i class="fluigicon fluigicon-chevron-down icon-sm"></i></span>';
            html += '</h3>';
            html += '<small>Configure coligadas e valores padrao desta jornada</small>';
            html += '</div>';
            html += '<div class="panel-body painel-jornada-body" data-jornada="' + that.escapeHtml(codigo) + '" data-loaded="false" style="display:none;">';
            html += '<p class="text-muted">Clique para carregar...</p>';
            html += '</div>';
            html += '</div>';
        }

        $container.html(html);
        $container.find(".painel-jornada-body").hide();
        this.vincularEventosPaineisJornada();
    },

    popularSelectsCamposZoom: function () {
        // Mantida apenas por compatibilidade.
        // Os zooms agora carregam sob demanda em carregarOpcoesZoomCampo().
    },

    carregarOpcoesZoomCampo: function ($select) {
        var that = this;

        if (!$select || !$select.length) {
            return;
        }

        if ($select.attr("data-loaded") === "true" || $select.attr("data-loading") === "true") {
            return;
        }

        var datasetId = $.trim($select.attr("data-dataset") || "");
        var valueField = $.trim($select.attr("data-value-field") || "");
        var textField = $.trim($select.attr("data-text-field") || "");
        var campoId = $.trim($select.attr("data-campo-id") || "");
        var valorAtual = $.trim($select.attr("data-valor-atual") || $select.val() || "");
        var dependeDe = [];
        var constraints = [];
        var coligadaObrigatoria = $.trim($select.attr("data-usa-coligada-jornada") || "").toLowerCase() === "true";
        var coligadaConstraintField = $.trim($select.attr("data-coligada-constraint-field") || "");

        if (!datasetId) {
            that.limparSelectZoomCampo($select, "Dataset nao configurado", valorAtual);
            return;
        }

        try {
            dependeDe = JSON.parse($select.attr("data-depende-de") || "[]");
        } catch (e) {
            dependeDe = [];
        }

        for (var d = 0; d < dependeDe.length; d++) {
            var dependencia = dependeDe[d] || {};
            var valorDependencia = that.obterValorCampoNoPainelJornada($select, dependencia.campoId || "");

            if (!valorDependencia) {
                var campoDependencia = that.obterCampoDoCatalogo(dependencia.campoId || "");
                var labelDependencia = dependencia.label || (campoDependencia && campoDependencia.label ? campoDependencia.label : (dependencia.campoId || "campo"));
                that.limparSelectZoomCampo($select, "Selecione " + labelDependencia + " para carregar", valorAtual);
                return;
            }

            constraints.push({
                fieldName: dependencia.constraintField || dependencia.campoId || "",
                initialValue: valorDependencia,
                finalValue: valorDependencia,
                constraintType: "MUST",
                type: "MUST",
                likeSearch: false
            });
        }

        if (coligadaObrigatoria) {
            var coligadaBase = that.obterColigadaBaseDoPainelJornada($select);

            if (!coligadaBase) {
                that.limparSelectZoomCampo($select, "Defina uma coligada especifica para carregar", valorAtual);
                return;
            }

            constraints.push({
                fieldName: coligadaConstraintField || "ID_EMPRESA",
                initialValue: coligadaBase,
                finalValue: coligadaBase,
                constraintType: "MUST",
                type: "MUST",
                likeSearch: false
            });
        }

        var cacheKey = that.montarChaveCacheZoom(datasetId, constraints);

        var preencher = function (itens) {
            var html = '<option value=""></option>';
            var valorEncontrado = false;

            for (var i = 0; i < itens.length; i++) {
                var item = itens[i] || {};
                var valorItem = that.resolverValorItemZoom(item, valueField);

                if (valorItem === undefined || valorItem === null) {
                    valorItem = "";
                }

                var textoItem = that.resolverTextoItemZoom(item, textField, valorItem);

                if (textoItem === undefined || textoItem === null || textoItem === "") {
                    textoItem = valorItem;
                }

                if (String(valorItem) === String(valorAtual)) {
                    valorEncontrado = true;
                }

                html += '<option value="' + that.escapeHtml(valorItem) + '"' + (String(valorItem) === String(valorAtual) ? ' selected="selected"' : '') + '>' + that.escapeHtml(textoItem) + '</option>';
            }

            if (valorAtual && !valorEncontrado) {
                html += '<option value="' + that.escapeHtml(valorAtual) + '" selected="selected">' + that.escapeHtml(valorAtual) + '</option>';
            }

            $select.html(html);

            if (valorAtual) {
                $select.val(valorAtual);
            }

            $select.attr("data-loaded", "true");
            $select.removeAttr("data-loading");
        };

        if (Object.prototype.hasOwnProperty.call(that.opcoesDatasetCache, cacheKey)) {
            preencher(that.opcoesDatasetCache[cacheKey] || []);
            return;
        }

        $select.attr("data-loading", "true");
        $select.html('<option value="">Carregando...</option>');

        $.ajax({
            url: '/api/public/ecm/dataset/datasets',
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({
                name: datasetId,
                constraints: constraints
            }),
            success: function (res) {
                var itens = [];

                if (res && res.content && res.content.values) {
                    itens = res.content.values;
                } else if (res && res.values) {
                    itens = res.values;
                }

                that.opcoesDatasetCache[cacheKey] = itens;
                preencher(itens);
            },
            error: function () {
                that.opcoesDatasetCache[cacheKey] = [];
                that.limparSelectZoomCampo($select, "Erro ao carregar", valorAtual);
            }
        });
    },

    renderizarConteudoJornada: function (jornadaCodigo) {
        var that = this;
        var codigo = $.trim(String(jornadaCodigo || ""));

        if (!codigo) {
            return;
        }

        var jornada = null;
        for (var i = 0; i < this.jornadasAdmissao.length; i++) {
            if (that.chaveCodigoJornada(this.jornadasAdmissao[i].codigo) === that.chaveCodigoJornada(codigo)) {
                jornada = this.jornadasAdmissao[i];
                break;
            }
        }

        if (!jornada) {
            return;
        }

        var $body = $("#container_paineis_jornada_" + this.instanceId + ' .painel-jornada-body[data-jornada="' + codigo + '"]');
        if (!$body.length) {
            return;
        }

        var coligadasSelecionadas = that.normalizarColigadasJornada(jornada.coligadas);
        var valorHiddenColigadas = coligadasSelecionadas.indexOf("*") !== -1 ? "*" : coligadasSelecionadas.join(",");
        var html = "";

        html += '<div class="table-responsive">';
        html += '<table class="table table-striped table-hover table-condensed tabela-campos-jornada" data-jornada="' + that.escapeHtml(codigo) + '">';
        html += '<thead><tr><th style="width: 35%;">Parametro</th><th>Valor padrao</th></tr></thead>';
        html += '<tbody>';
        html += '<tr class="linha-coligadas-jornada" data-jornada="' + that.escapeHtml(codigo) + '">';
        html += '<td>Coligadas habilitadas</td>';
        html += '<td>';
        html += '<div class="coligadas-jornada-wrapper" data-jornada="' + that.escapeHtml(codigo) + '">';
        html += '<input type="hidden" class="jornada-coligadas" value="' + that.escapeHtml(valorHiddenColigadas) + '">';
        html += '<div class="row">';
        html += '<div class="col-md-9">';
        html += '<select class="form-control jornada-coligada-disponivel">';
        html += this.montarOptionsColigadasDisponiveis(coligadasSelecionadas);
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-3">';
        html += '<button type="button" class="btn btn-primary btn-block btn-add-coligada-jornada">Adicionar</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="coligadas-selecionadas" style="margin-top:10px;"></div>';
        html += '</div>';
        html += '</td>';
        html += '</tr>';

        for (var f = 0; f < this.catalogoCamposJornada.length; f++) {
            var campo = this.catalogoCamposJornada[f];
            var configuracaoCampo = that.obterCampoParametrizado(codigo, campo.id) || {};
            var valorCampo = configuracaoCampo.valor || "";
            var descricaoCampo = configuracaoCampo.descricao || "";
            var valorExibicaoCampo = descricaoCampo || valorCampo;
            var tipoCampo = campo.tipo || "texto";

            html += '<tr data-jornada="' + that.escapeHtml(codigo) + '" data-campo-id="' + that.escapeHtml(campo.id) + '">';
            html += '<td>' + that.escapeHtml(campo.label) + '</td>';
            html += '<td>';

            if (tipoCampo === 'select') {
                html += '<select class="form-control campo-jornada-valor" data-tipo="select">';
                html += '<option value="">Selecione</option>';
                for (var o = 0; o < (campo.opcoes || []).length; o++) {
                    var opcao = campo.opcoes[o];
                    var selecionado = String(opcao.valor) === String(valorCampo) || String(opcao.texto) === String(valorExibicaoCampo);
                    html += '<option value="' + that.escapeHtml(opcao.valor) + '"' + (selecionado ? ' selected="selected"' : '') + '>' + that.escapeHtml(opcao.texto) + '</option>';
                }
                html += '</select>';
            } else if (tipoCampo === 'zoom') {
                html += '<select class="form-control campo-jornada-valor campo-jornada-zoom" ' +
                    'data-campo-id="' + that.escapeHtml(campo.id || '') + '" ' +
                    'data-dataset="' + that.escapeHtml(campo.datasetId || '') + '" ' +
                    'data-value-field="' + that.escapeHtml(campo.valueField || '') + '" ' +
                    'data-text-field="' + that.escapeHtml(campo.textField || '') + '" ' +
                    'data-depende-de="' + that.escapeHtml(JSON.stringify(campo.dependeDe || [])) + '" ' +
                    'data-usa-coligada-jornada="' + (campo.usaColigadaJornada ? 'true' : 'false') + '" ' +
                    'data-coligada-constraint-field="' + that.escapeHtml(campo.coligadaConstraintField || '') + '" ' +
                    'data-valor-atual="' + that.escapeHtml(valorCampo) + '" ' +
                    'data-loaded="false">';
                if (valorCampo || valorExibicaoCampo) {
                    html += '<option value="' + that.escapeHtml(valorCampo || valorExibicaoCampo) + '" selected="selected">' + that.escapeHtml(valorExibicaoCampo || valorCampo) + '</option>';
                    html += '<option value="">Clique para carregar...</option>';
                } else {
                    html += '<option value="" selected="selected">Clique para carregar...</option>';
                }
                html += '</select>';
            } else {
                html += '<input type="text" class="form-control campo-jornada-valor" value="' + that.escapeHtml(valorCampo) + '">';
            }

            html += '</td>';
            html += '</tr>';
        }

        html += '</tbody></table>';
        html += '</div>';

        $body.html(html);
        $body.attr("data-loaded", "true");
        this.renderizarColigadasSelecionadasWrapper($body.find(".coligadas-jornada-wrapper"));
        this.vincularEventosPaineisJornada();
    },

    alternarPainelJornada: function (jornadaCodigo) {
        var that = this;
        var $container = $("#container_paineis_jornada_" + this.instanceId);
        var $body = $container.find('.painel-jornada-body[data-jornada="' + jornadaCodigo + '"]');
        var $painel = $body.closest('.painel-param-jornada');

        this.sincronizarJornadasDosPaineis();
        this.sincronizarCamposJornadaDosPaineis();

        if ($body.is(":visible")) {
            $body.hide();
            $painel.removeClass("jornada-aberta");
            return;
        }

        $container.find(".painel-jornada-body:visible").hide();
        $container.find(".painel-param-jornada").removeClass("jornada-aberta");

        if ($body.attr("data-loaded") !== "true") {
            this.renderizarConteudoJornada(jornadaCodigo);
        }

        $body.show();
        $painel.addClass("jornada-aberta");
    },

    sincronizarCamposJornadaDosPaineis: function () {
        var that = this;
        var antigos = this.camposJornadaAdmissao || [];
        var jornadasRenderizadas = {};
        var novaLista = [];

        $("#container_paineis_jornada_" + this.instanceId + " .painel-jornada-body[data-loaded='true']").each(function () {
            var jornada = $.trim($(this).attr("data-jornada") || "");
            if (jornada) {
                jornadasRenderizadas[that.chaveCodigoJornada(jornada)] = true;
            }
        });

        for (var i = 0; i < antigos.length; i++) {
            var chaveAntiga = that.chaveCodigoJornada(antigos[i].jornadaCodigo);
            if (!jornadasRenderizadas[chaveAntiga]) {
                novaLista.push(antigos[i]);
            }
        }

        $("#container_paineis_jornada_" + this.instanceId + " .painel-jornada-body[data-loaded='true'] .tabela-campos-jornada tbody tr").each(function () {
            var $linha = $(this);
            var jornadaCodigo = $.trim($linha.attr('data-jornada') || '');
            var campoId = $.trim($linha.attr('data-campo-id') || '');
            if (!campoId) {
                return;
            }
            var campoCatalogo = that.obterCampoDoCatalogo(campoId) || {};
            var $valor = $linha.find('.campo-jornada-valor').first();
            var valorCampo = $.trim($valor.val() || '');
            var descricaoCampo = "";

            if ($valor.is('select')) {
                descricaoCampo = $.trim($valor.find('option:selected').text() || '');

                if (!descricaoCampo || descricaoCampo === "Selecione" || descricaoCampo === "Clique para carregar..." || descricaoCampo === valorCampo) {
                    descricaoCampo = valorCampo;
                }
            } else {
                descricaoCampo = valorCampo;
            }

            if (window.DEBUG_PARAM_JORNADA !== false) {
                console.log("[Widget Jornada] Campo sincronizado", {
                    jornadaCodigo: jornadaCodigo,
                    campoId: campoId,
                    campoTipo: campoCatalogo.tipo || "",
                    valorTecnico: valorCampo,
                    textoVisual: descricaoCampo,
                    datasetId: campoCatalogo.datasetId || "",
                    valueField: campoCatalogo.valueField || "",
                    textField: campoCatalogo.textField || ""
                });
            }

            novaLista.push({
                jornadaCodigo: jornadaCodigo,
                campoId: campoId,
                campoLabel: campoCatalogo.label || $linha.find('td').eq(0).text(),
                campoTipo: campoCatalogo.tipo || "",
                valor: valorCampo,
                descricao: descricaoCampo,
                ativo: "S",
                ordem: "",
                jsonExtra: JSON.stringify({
                    datasetId: campoCatalogo.datasetId || "",
                    campoId: campoCatalogo.id || campoId,
                    valueField: campoCatalogo.valueField || "",
                    textField: campoCatalogo.textField || "",
                    hiddenFields: campoCatalogo.hiddenFields || [],
                    dependeDe: campoCatalogo.dependeDe || [],
                    usaColigadaJornada: campoCatalogo.usaColigadaJornada ? true : false,
                    coligadaConstraintField: campoCatalogo.coligadaConstraintField || ""
                })
            });
        });

        if (window.DEBUG_PARAM_JORNADA !== false) {
            console.log("[Widget Jornada] Resumo final da sincronizacao de campos", novaLista.map(function (item, idx) {
                return {
                    indice: idx + 1,
                    jornadaCodigo: item.jornadaCodigo || "",
                    campoId: item.campoId || "",
                    campoTipo: item.campoTipo || "",
                    valor: item.valor || "",
                    descricao: item.descricao || "",
                    jsonExtra: item.jsonExtra || ""
                };
            }));
        }

        this.camposJornadaAdmissao = novaLista;
    },

    sincronizarJornadasDosPaineis: function () {
        var that = this;
        var jornadasAtuais = (this.jornadasAdmissao || []).slice(0);
        this.jornadasAdmissao = [];

        $("#container_paineis_jornada_" + this.instanceId + " .painel-param-jornada").each(function () {
            var $painel = $(this);
            var codigo = $.trim($painel.attr('data-jornada') || '');
            var descricao = "";
            var jornadaAtual = null;
            var $body = $painel.find('.painel-jornada-body[data-jornada="' + codigo + '"]');
            var coligadas = "*";

            for (var j = 0; j < jornadasAtuais.length; j++) {
                if (that.chaveCodigoJornada(jornadasAtuais[j].codigo) === that.chaveCodigoJornada(codigo)) {
                    jornadaAtual = jornadasAtuais[j];
                    break;
                }
            }

            if (jornadaAtual && jornadaAtual.descricao) {
                descricao = jornadaAtual.descricao;
            }

            if ($body.length && $body.attr("data-loaded") === "true") {
                coligadas = $.trim($body.find('.jornada-coligadas').val() || "*");
                if (!coligadas) {
                    coligadas = "*";
                }
            } else if (jornadaAtual && jornadaAtual.coligadas) {
                coligadas = jornadaAtual.coligadas;
            }

            if (!codigo) {
                return;
            }

            that.jornadasAdmissao.push({
                codigo: codigo,
                descricao: descricao,
                coligadas: coligadas,
                ativo: 'S',
                ordem: ''
            });
        });
    },

    vincularEventosPaineisJornada: function () {
        var that = this;
        var namespace = '.widgetPainelJornada' + this.instanceId;
        var seletorContainer = '#container_paineis_jornada_' + this.instanceId;

        $(document).off('input' + namespace + ' change' + namespace + ' blur' + namespace, seletorContainer + ' :input');
        $(document).on('input' + namespace + ' change' + namespace + ' blur' + namespace, seletorContainer + ' :input', function () {
            var $campo = $(this);
            var ehColigada = $campo.hasClass('jornada-coligadas');
            var campoIdAlterado = $.trim($campo.closest('tr[data-campo-id]').attr('data-campo-id') || $campo.attr('data-campo-id') || '');

            if ($campo.hasClass("campo-jornada-zoom")) {
                $campo.attr("data-valor-atual", $.trim($campo.val() || ""));
            }

            if (campoIdAlterado || ehColigada) {
                that.limparCamposZoomDependentesDoCampo($campo, ehColigada ? "__JORNADA_COLIGADA__" : campoIdAlterado, ehColigada);
            }

            that.sincronizarJornadasDosPaineis();
            that.sincronizarCamposJornadaDosPaineis();
        });

        $(document).off('click' + namespace, seletorContainer + ' .painel-jornada-toggle');
        $(document).on('click' + namespace, seletorContainer + ' .painel-jornada-toggle', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var jornadaCodigo = $.trim($(this).attr('data-jornada') || "");
            if (!jornadaCodigo) {
                return;
            }
            that.alternarPainelJornada(jornadaCodigo);
        });

        $(document).off('focusin' + namespace + ' mousedown' + namespace, seletorContainer + ' .campo-jornada-zoom');
        $(document).on('focusin' + namespace + ' mousedown' + namespace, seletorContainer + ' .campo-jornada-zoom', function () {
            that.carregarOpcoesZoomCampo($(this));
        });

        $(document).off('click' + namespace, seletorContainer + ' .btn-add-coligada-jornada');
        $(document).on('click' + namespace, seletorContainer + ' .btn-add-coligada-jornada', function () {
            var $wrapper = $(this).closest('.coligadas-jornada-wrapper');
            var $hidden = $wrapper.find('.jornada-coligadas');
            var $select = $wrapper.find('.jornada-coligada-disponivel');
            var valorAdicionar = $.trim($select.val() || "");

            if (!valorAdicionar) {
                return;
            }

            var selecionadas = that.normalizarColigadasJornada($hidden.val());

            if (valorAdicionar === "*") {
                selecionadas = ["*"];
            } else {
                if (selecionadas.indexOf("*") !== -1) {
                    selecionadas = [];
                }

                if (selecionadas.indexOf(valorAdicionar) === -1) {
                    selecionadas.push(valorAdicionar);
                }
            }

            var valorFinal = selecionadas.indexOf("*") !== -1 ? "*" : selecionadas.join(",");
            $hidden.val(valorFinal);
            that.renderizarColigadasSelecionadasWrapper($wrapper);
            that.limparCamposZoomDependentesDoCampo($hidden, "__JORNADA_COLIGADA__", true);
            that.sincronizarJornadasDosPaineis();
            that.sincronizarCamposJornadaDosPaineis();
        });

        $(document).off('click' + namespace, seletorContainer + ' .btn-remove-coligada-jornada');
        $(document).on('click' + namespace, seletorContainer + ' .btn-remove-coligada-jornada', function () {
            var $wrapper = $(this).closest('.coligadas-jornada-wrapper');
            var $hidden = $wrapper.find('.jornada-coligadas');
            var remover = $.trim($(this).attr('data-coligada') || "");
            var selecionadas = that.normalizarColigadasJornada($hidden.val());
            var novaLista = [];

            for (var i = 0; i < selecionadas.length; i++) {
                if (selecionadas[i] !== remover && selecionadas[i] !== "*") {
                    novaLista.push(selecionadas[i]);
                }
            }

            if (!novaLista.length) {
                novaLista = ["*"];
            }

            var valorFinal = novaLista.indexOf("*") !== -1 ? "*" : novaLista.join(",");
            $hidden.val(valorFinal);
            that.renderizarColigadasSelecionadasWrapper($wrapper);
            that.limparCamposZoomDependentesDoCampo($hidden, "__JORNADA_COLIGADA__", true);
            that.sincronizarJornadasDosPaineis();
            that.sincronizarCamposJornadaDosPaineis();
        });
    },

    renderizarTabelaCamposJornada: function () {
        this.renderizarPaineisJornadaCampos();
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
        $("#Widget_Configuracao_Admissao_" + this.instanceId + " .form-control").val('');
        this.documentId = null;
        this.parametrosFilial = [];
        this.jornadasAdmissao = [];
        this.camposJornadaAdmissao = [];
        this.jornadaCodigoEmEdicao = null;
        this.jornadaColigadasEmEdicao = null;
        $("#config_doc_id_" + this.instanceId).val('');
        this.renderizarTabelaParametros();
        this.inicializarJornadasPadrao();
        this.renderizarPaineisJornadaCampos();
        this.atualizarSelectCamposJornada();
        this.carregarColigadasJornada();

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
            that.jornadaCodigoEmEdicao = null;
            that.jornadaColigadasEmEdicao = null;
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
            that.jornadasAdmissao = [];
            that.renderizarTabelaJornadas();
            that.renderizarPaineisJornadaCampos();
            that.camposJornadaAdmissao = [];
            that.renderizarPaineisJornadaCampos();

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

            $.ajax({
                url: WCMAPI.getServerURL() + '/api/public/ecm/dataset/datasets',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    name: "Form_Configuracoes_Admissao",
                    constraints: [
                        { "_field": "tablename", "_initialValue": "tbJornadasAdmissao", "_finalValue": "tbJornadasAdmissao", "_type": 1 },
                        { "_field": "metadata#id", "_initialValue": docId, "_finalValue": docId, "_type": 1 }
                    ]
                }),
                success: function (res) {
                    if (res && res.content && res.content.values) {
                        res.content.values.forEach(function (item) {
                            that.jornadasAdmissao.push({
                                codigo: item.JORNADA_CODIGO,
                                descricao: item.JORNADA_DESCRICAO,
                                coligadas: item.JORNADA_COLIGADAS,
                                ativo: item.JORNADA_ATIVO,
                                ordem: item.JORNADA_ORDEM
                            });
                        });
                        that.renderizarTabelaJornadas();
                        that.atualizarSelectJornadasCampos();
                        that.renderizarPaineisJornadaCampos();
                    }
                }
            });

            $.ajax({
                url: WCMAPI.getServerURL() + '/api/public/ecm/dataset/datasets',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    name: "Form_Configuracoes_Admissao",
                    constraints: [
                        { "_field": "tablename", "_initialValue": "tbCamposJornadaAdmissao", "_finalValue": "tbCamposJornadaAdmissao", "_type": 1 },
                        { "_field": "metadata#id", "_initialValue": docId, "_finalValue": docId, "_type": 1 }
                    ]
                }),
                success: function (res) {
                    if (res && res.content && res.content.values) {
                        res.content.values.forEach(function (item) {
                            that.camposJornadaAdmissao.push({
                                jornadaCodigo: item.CJ_JORNADA_CODIGO,
                                campoId: item.CJ_CAMPO_ID,
                                campoLabel: item.CJ_CAMPO_LABEL,
                                campoTipo: item.CJ_CAMPO_TIPO,
                                valor: item.CJ_VALOR,
                                descricao: item.CJ_DESCRICAO,
                                jsonExtra: item.CJ_JSON_EXTRA,
                                ativo: item.CJ_ATIVO,
                                ordem: item.CJ_ORDEM
                            });
                        });
                        that.renderizarPaineisJornadaCampos();
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

        this.sincronizarJornadasDosPaineis();
        this.sincronizarCamposJornadaDosPaineis();

        if (window.DEBUG_PARAM_JORNADA !== false) {
            console.log("[Widget Jornada] Tabela final pronta para gravacao", this.camposJornadaAdmissao.map(function (item, idx) {
                return {
                    indice: idx + 1,
                    jornadaCodigo: item.jornadaCodigo || "",
                    campoId: item.campoId || "",
                    valor: item.valor || "",
                    descricao: item.descricao || ""
                };
            }));
        }

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
        var indexJornada = 1;
        that.jornadasAdmissao.forEach(function (jornada) {
            formData.push({ "name": "JORNADA_CODIGO___" + indexJornada, "value": jornada.codigo || "" });
            formData.push({ "name": "JORNADA_DESCRICAO___" + indexJornada, "value": jornada.descricao || "" });
            formData.push({ "name": "JORNADA_COLIGADAS___" + indexJornada, "value": jornada.coligadas || "*" });
            formData.push({ "name": "JORNADA_ATIVO___" + indexJornada, "value": jornada.ativo || "S" });
            formData.push({ "name": "JORNADA_ORDEM___" + indexJornada, "value": jornada.ordem || "" });
            indexJornada++;
        });

        var indexCampoJornada = 1;
        that.camposJornadaAdmissao.forEach(function (item) {
            formData.push({ "name": "CJ_JORNADA_CODIGO___" + indexCampoJornada, "value": item.jornadaCodigo || "" });
            formData.push({ "name": "CJ_CAMPO_ID___" + indexCampoJornada, "value": item.campoId || "" });
            formData.push({ "name": "CJ_CAMPO_LABEL___" + indexCampoJornada, "value": item.campoLabel || "" });
            formData.push({ "name": "CJ_CAMPO_TIPO___" + indexCampoJornada, "value": item.campoTipo || "" });
            formData.push({ "name": "CJ_VALOR___" + indexCampoJornada, "value": item.valor || "" });
            formData.push({ "name": "CJ_DESCRICAO___" + indexCampoJornada, "value": item.descricao || "" });
            formData.push({ "name": "CJ_JSON_EXTRA___" + indexCampoJornada, "value": item.jsonExtra || "" });
            formData.push({ "name": "CJ_ATIVO___" + indexCampoJornada, "value": item.ativo || "S" });
            formData.push({ "name": "CJ_ORDEM___" + indexCampoJornada, "value": item.ordem || "" });
            indexCampoJornada++;
        });

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
