# Notas das correções — TizenTube v1.2

As alterações abaixo foram identificadas comparando os WGTs corrigidos com os
WGTs originais fornecidos nesta conversa. Em ambos os pacotes, o único membro
interno alterado foi `service/dist/index.js`; os demais arquivos do WGT foram
mantidos.

## 1. Login manual / injeção do userScript

Na função `rewriteBody`, a condição de elegibilidade passou a reconhecer também
URLs no formato:

`/cors-bypass/https://www.youtube.com/tv...`

A verificação usa uma expressão regular que aceita `youtube.com` e
`www.youtube.com`, além de caminhos seguidos por `/`, `?`, `#` ou fim da URL.
Isso permite que o HTML do YouTube TV recebido pelo fluxo de retorno do login
manual também passe pelo processamento que injeta/aplica as alterações do app.
O caminho `/tv_config` continua excluído.

## 2. Origem local estável

### Tizen 5.0
A configuração de origem estável já existente foi mantida. O proxy continua
usando o host de loopback `127.0.0.2` como fallback, sem depender do IP da rede
Wi-Fi da TV.

### Tizen 5.5
A lógica do host do proxy foi alterada para priorizar:
1. `TUBE_PROXY_HOST`, quando configurado;
2. o host de `--base_url`, quando disponível;
3. `127.0.0.2` como fallback estável.

O host visto na rede (`seen.host`) deixou de ser a escolha padrão do proxy.
A intenção é evitar que a origem de cookies e `localStorage` mude quando o IP
da TV mudar.

## 3. Encerramento do container

A rotina de relançamento agora aguarda 1.500 ms antes de executar o encerramento
dos contextos do aplicativo, dando uma janela adicional para a persistência de
cookies e `localStorage`.

## Arquivos e limites

- Os dois WGTs corrigidos estão em `releases/`.
- Os bundles alterados estão em `build-artifacts/`.
- Não foram incluídos fontes originais não presentes nos WGTs.
- Como o JavaScript está compilado/minificado, os bundles não equivalem a um
  projeto-fonte editável completo.
- O teste em TV física, a assinatura Tizen e a validação funcional do login e
  da persistência ainda precisam ser feitos.
