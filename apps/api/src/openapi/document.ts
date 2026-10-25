import pkg from "../../package.json" with { type: "json" }
import {
  componentSchemas,
  idempotencyKeyHeaderSchema,
  limitParameterSchema,
  schemaRef,
  type JsonSchema,
} from "./components.js"

/** Minimal OpenAPI 3.1 document shape (only what we emit). */
export interface OpenApiDocument {
  openapi: string
  info: Record<string, unknown>
  servers: Record<string, unknown>[]
  tags: Record<string, unknown>[]
  paths: Record<string, Record<string, unknown>>
  components: {
    schemas: Record<string, JsonSchema>
    securitySchemes: Record<string, JsonSchema>
  }
}

const jsonContent = (schemaName: string): JsonSchema => ({
  content: { "application/json": { schema: schemaRef(schemaName) } },
})

const okResponse = (description: string, schemaName: string): JsonSchema => ({
  description,
  ...jsonContent(schemaName),
})

const errorResponse = (description: string): JsonSchema => ({
  description,
  ...jsonContent("Error"),
})

const jsonBody = (schemaName: string): JsonSchema => ({
  required: true,
  ...jsonContent(schemaName),
})

const idempotencyKeyParameter: JsonSchema = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  description:
    "Opcional. A mesma chave repetida com a mesma operação e o mesmo `amount` devolve o resultado original sem novo efeito; com outra operação ou outro `amount` retorna `409`.",
  schema: idempotencyKeyHeaderSchema,
}

// Applied only to /coins/* operations (research.md D7).
const secured: JsonSchema[] = [{ bearerAuth: [] }]

// Declared on every operation so an undeclared status (incl. the catch-all
// `404 route_not_found`) is still documented as the Error envelope.
const defaultError = errorResponse("Erro inesperado ou rota não encontrada (envelope de erro padrão).")

const INFO_DESCRIPTION = [
  "Backend `apps/api` do NFT Marketplace (feature 007), implantado como Vercel Serverless Functions.",
  "Esta documentação é **gerada a partir dos mesmos schemas Zod** que validam as requisições, então não pode divergir do comportamento real.",
  "",
  "**Limitações conhecidas (não escondidas):**",
  "",
  "1. **Emissão de token confia no `ownerId` pedido.** `POST /auth/token` emite um JWT para qualquer `ownerId` informado — não há login/senha real. É uma simplificação assumida do desafio, aceitável por não envolver dinheiro nem dados sensíveis reais. O *uso* subsequente é verificado (o `ownerId` vem só da claim do token), mas a *emissão* não autentica ninguém.",
  "2. **Persistência em Postgres (Neon).** Crédito e débito são uma única instrução SQL atômica (saldo + histórico juntos); débito sem saldo suficiente retorna `402` sem gravar nada. Não há `409` de concorrência.",
  "",
  "Exemplos de token são fictícios; nenhum segredo é exposto por esta API.",
].join("\n")

function assemble(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "NFT Marketplace — apps/api",
      version: typeof pkg.version === "string" ? pkg.version : "0.0.0",
      description: INFO_DESCRIPTION,
    },
    servers: [
      { url: "http://localhost:3000/api", description: "vercel dev" },
      { url: "http://localhost:4001/api", description: "listener local (pnpm dev:local)" },
      { url: "https://<deployment>.vercel.app/api", description: "produção (substitua <deployment>)" },
    ],
    tags: [
      { name: "health", description: "Verificação de saúde da função e do banco." },
      { name: "auth", description: "Emissão de token (confia no ownerId — ver descrição da API)." },
      { name: "coins", description: "Saldo e histórico de moedas — exige Bearer token." },
      {
        name: "profile",
        description:
          "Perfil do colecionador (nome de exibição, bio, ENS, apelido da carteira e foto) — exige Bearer token de dono; token de admin recebe `403`.",
      },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["health"],
          summary: "Verifica a função e a conexão com o banco.",
          operationId: "getHealth",
          responses: {
            "200": okResponse("Serviço saudável.", "HealthResponse"),
            "500": errorResponse("`DATABASE_URL` ausente (`missing_database_url`) ou banco inacessível (`database_unavailable`)."),
            default: defaultError,
          },
        },
      },
      "/auth/token": {
        post: {
          tags: ["auth"],
          summary: "Emite um JWT de 15 min para o ownerId informado (não autentica).",
          operationId: "issueToken",
          requestBody: jsonBody("TokenRequest"),
          responses: {
            "200": okResponse("Token emitido.", "TokenResponse"),
            "400": errorResponse("`ownerId` ausente ou vazio (`invalid_owner_id`)."),
            "500": errorResponse("`AUTH_JWT_SECRET` ausente (`missing_auth_secret`)."),
            default: defaultError,
          },
        },
      },
      "/coins/balance": {
        get: {
          tags: ["coins"],
          summary: "Saldo do owner identificado pelo token.",
          operationId: "getBalance",
          security: secured,
          responses: {
            "200": okResponse("Saldo atual (owner novo → amount 0, version 0).", "CoinBalanceRecord"),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            default: defaultError,
          },
        },
      },
      "/coins/topup": {
        post: {
          tags: ["coins"],
          summary: "Credita o saldo do owner do token.",
          operationId: "topUp",
          security: secured,
          parameters: [idempotencyKeyParameter],
          requestBody: jsonBody("AmountRequest"),
          responses: {
            "200": okResponse("Saldo atualizado após o crédito.", "CoinBalanceRecord"),
            "400": errorResponse("Body inválido (`invalid_amount`) ou `Idempotency-Key` inválida (`invalid_idempotency_key`)."),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            "409": errorResponse("`Idempotency-Key` já usada com outra operação ou outro valor (`idempotency_key_conflict`)."),
            "500": errorResponse("Falha no banco; nada foi aplicado (a instrução é atômica)."),
            default: defaultError,
          },
        },
      },
      "/coins/debit": {
        post: {
          tags: ["coins"],
          summary: "Debita o saldo do owner do token.",
          operationId: "debit",
          security: secured,
          parameters: [idempotencyKeyParameter],
          requestBody: jsonBody("AmountRequest"),
          responses: {
            "200": okResponse("Saldo atualizado após o débito.", "CoinBalanceRecord"),
            "400": errorResponse("Body inválido (`invalid_amount`) ou `Idempotency-Key` inválida (`invalid_idempotency_key`)."),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            "402": errorResponse("Saldo insuficiente (`insufficient_balance`) — nada é escrito."),
            "409": errorResponse("`Idempotency-Key` já usada com outra operação ou outro valor (`idempotency_key_conflict`)."),
            "500": errorResponse("Falha no banco; nada foi aplicado (a instrução é atômica)."),
            default: defaultError,
          },
        },
      },
      "/coins/transactions": {
        get: {
          tags: ["coins"],
          summary: "Histórico de transações do owner do token (mais recente primeiro).",
          operationId: "listTransactions",
          security: secured,
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Inteiro entre 1 e 200 (default 50).",
              schema: limitParameterSchema,
            },
          ],
          responses: {
            "200": okResponse("Lista de transações.", "TransactionsResponse"),
            "400": errorResponse("`limit` inválido (`invalid_limit`)."),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            default: defaultError,
          },
        },
      },
      "/profile": {
        get: {
          tags: ["profile"],
          summary: "Perfil do owner do token.",
          description:
            "Um owner que nunca salvou o perfil recebe `200` com valores vazios, `ensTld: \".eth\"` e `updatedAt: null` (nunca `404`). `avatarVersion` é o instante da última troca de foto (ou `null`): o cliente guarda a imagem em cache por essa versão.",
          operationId: "getProfile",
          security: secured,
          responses: {
            "200": okResponse("Perfil atual.", "ProfileResponse"),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            "403": errorResponse("Token de admin em rota de dono (`wrong_token_type`)."),
            default: defaultError,
          },
        },
        put: {
          tags: ["profile"],
          summary: "Substitui os cinco campos de texto do perfil (cria no primeiro uso).",
          description:
            "Substituição integral e idempotente: o mesmo corpo repetido deixa o mesmo estado. O último salvamento vence. O dono vem **só** do token; um `ownerId` no corpo é ignorado. Todos os campos inválidos voltam juntos em `error.fields`, e nada é gravado.",
          operationId: "saveProfile",
          security: secured,
          requestBody: jsonBody("SaveProfileRequest"),
          responses: {
            "200": okResponse("Perfil salvo.", "ProfileResponse"),
            "400": errorResponse(
              "`validation_error` com `fields` por campo: `displayName` → `too_short` | `too_long`; `bio` → `too_long`; `ensName` → `invalid_format`; `ensTld` → `invalid`; `walletNickname` → `too_long`; campo ausente ou de tipo errado → `invalid`. Corpo que não é JSON: `invalid_json`.",
            ),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            "403": errorResponse("Token de admin em rota de dono (`wrong_token_type`)."),
            "500": errorResponse("Falha no banco; nada foi aplicado (a instrução é atômica)."),
            default: defaultError,
          },
        },
      },
      "/profile/avatar": {
        get: {
          tags: ["profile"],
          summary: "Foto do perfil do owner do token (data URL).",
          description:
            "Devolve a imagem como data URL e a `version` (a mesma `avatarVersion` do perfil). Existe separada do `GET /profile` para o perfil nunca carregar até 1,4 MB (base64) a cada página.",
          operationId: "getAvatar",
          security: secured,
          responses: {
            "200": okResponse("Foto atual.", "AvatarResponse"),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            "403": errorResponse("Token de admin em rota de dono (`wrong_token_type`)."),
            "404": errorResponse("O owner não tem foto (`no_avatar`)."),
            default: defaultError,
          },
        },
        put: {
          tags: ["profile"],
          summary: "Troca a foto do perfil (substitui a anterior).",
          description:
            "Aceita só PNG, JPEG ou WebP de até 1.048.576 bytes **decodificados**. O tipo é conferido pelos **bytes** (assinatura), nunca pelo nome do arquivo, e deve coincidir com o tipo declarado no data URL. Esta rota usa um parser JSON de 2 MB; acima disso a resposta é `413`. Uma foto recusada deixa a atual intacta.",
          operationId: "saveAvatar",
          security: secured,
          requestBody: jsonBody("SaveAvatarRequest"),
          responses: {
            "200": okResponse("Foto salva; o perfil devolve a nova `avatarVersion`.", "ProfileResponse"),
            "400": errorResponse(
              "`validation_error` com `fields.avatar`: `invalid_format` (não é data URL de PNG/JPEG/WebP, base64 inválido, bytes sem a assinatura do tipo ou tipo declarado diferente do detectado) ou `too_large` (mais de 1.048.576 bytes decodificados). Corpo que não é JSON: `invalid_json`.",
            ),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            "403": errorResponse("Token de admin em rota de dono (`wrong_token_type`)."),
            "413": errorResponse("Corpo acima de 2 MB (`payload_too_large`)."),
            "500": errorResponse("Falha no banco; nada foi aplicado (a instrução é atômica)."),
            default: defaultError,
          },
        },
        delete: {
          tags: ["profile"],
          summary: "Remove a foto do perfil.",
          description: "Idempotente: sem foto também responde `200`, com `avatarVersion: null`.",
          operationId: "deleteAvatar",
          security: secured,
          responses: {
            "200": okResponse("Perfil sem foto (`avatarVersion: null`).", "ProfileResponse"),
            "401": errorResponse("Token ausente, expirado ou inválido."),
            "403": errorResponse("Token de admin em rota de dono (`wrong_token_type`)."),
            default: defaultError,
          },
        },
      },
    },
    components: {
      schemas: componentSchemas,
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  }
}

// Memoized per process: the document is pure (Zod → JSON Schema → object), so we
// build it once and serve the same instance (research.md D5).
let cached: OpenApiDocument | null = null

export function buildOpenApiDocument(): OpenApiDocument {
  if (cached === null) {
    cached = assemble()
  }
  return cached
}
