# Contribuindo com o catálogo

Obrigado por ajudar a manter o Guia. Contribuições são bem-vindas principalmente para taxas municipais e estaduais, mas cada item precisa ser verificável e caber no escopo público do projeto.

## Antes de abrir uma contribuição

1. Consulte [`data/schema.json`](data/schema.json) e procure um item equivalente em [`data/tributos.json`](data/tributos.json).
2. Reúna uma fonte primária ou institucional (lei, decreto, órgão arrecadador ou página oficial) e a data da consulta.
3. Não inclua alíquotas, cálculo, aconselhamento ou dados pessoais. O Guia descreve e classifica; não apura.

## Formato do item

A forma preferida é abrir o template **Novo item do catálogo**. Para uma alteração direta, adicione um objeto em `data/tributos.json` com:

- `id`: slug minúsculo, único e permanente (`^[a-z0-9]+(-[a-z0-9]+)*$`);
- `sigla`, `nome`, `tipo`, `esfera`, `contexto`, `descricao` e `status`: obrigatórios;
- `nota_status` e `aliases`: opcionais;
- valores de `status`: `Vigente`, `Em transição`, `Em implantação`, `Varia por ente`, `Não instituído` ou `Histórico`.

Para taxa local, informe a abrangência no nome ou na descrição (município/UF), não crie uma entrada genérica para todos os entes.

## Checklist do pull request

- [ ] A fonte permite conferir a existência, o nome e a competência do item.
- [ ] O `id` não duplica nem reutiliza outro identificador.
- [ ] A descrição é informativa, neutra e não promete cálculo.
- [ ] Rodei `npm run build` e commitei os artefatos em `public/`.
- [ ] Rodei `npm run gate:contribuicao` e `npm run gate:build`.
- [ ] Expliquei no PR a fonte, a data de consulta e eventuais incertezas.

O CI reprova o PR com uma mensagem apontando o campo inválido. Corrija a fonte em `data/tributos.json`, regenere `public/` e envie novamente. Não edite `public/index.html` manualmente.

## Licença e revisão

Ao contribuir, você concorda que o conteúdo do catálogo seja distribuído sob [CC BY 4.0](data/LICENSE). O código continua sob MIT. A revisão editorial pode pedir uma fonte melhor, separar itens ambíguos ou recusar algo fora do escopo.
