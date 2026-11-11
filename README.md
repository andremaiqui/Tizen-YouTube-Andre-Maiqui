# TizenTube v1.2 — correções para Tizen 5.0 e 5.5

Este pacote reúne os artefatos corrigidos a partir dos dois WGTs fornecidos e das
alterações descritas no documento de análise.

## Conteúdo

- `releases/TizenTube-v1.2-W50-corrigido.wgt` — pacote corrigido para Tizen 5.0.
- `releases/TizenTube-v1.2-W55-corrigido.wgt` — pacote corrigido para Tizen 5.5.
- `build-artifacts/tizen-5.0/service/dist/index.js` — bundle de serviço alterado da versão 5.0.
- `build-artifacts/tizen-5.5/service/dist/index.js` — bundle de serviço alterado da versão 5.5.
- `PATCH_NOTES.md` — resumo técnico das alterações.
- `SHA256SUMS.txt` — hashes SHA-256 dos WGTs de saída.

## Como usar no GitHub

Extraia o ZIP na pasta do repositório e revise os arquivos antes de fazer commit.
Os WGTs estão na pasta `releases/`. Os bundles são artefatos compilados/minificados,
não substituem o projeto-fonte original.

## Importante

Os pacotes foram comparados com os WGTs originais e os arquivos alterados foram
identificados. Não foi possível executar os aplicativos em uma TV Samsung nesta
etapa. Portanto, as correções ainda precisam de teste real em cada versão do Tizen.
A assinatura/certificação Tizen não está incluída.
