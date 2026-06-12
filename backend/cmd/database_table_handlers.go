package cmd

import (
	"devnest/internal/service/database"
)

func tableTargetFromPayload(payload map[string]interface{}) database.TableTarget {
	engine, _ := payload["engine"].(string)
	databaseName, _ := payload["database"].(string)
	sqlitePath, _ := payload["sqlite_path"].(string)
	table, _ := payload["table"].(string)
	return database.TableTarget{
		Engine:     engine,
		Database:   databaseName,
		SQLitePath: sqlitePath,
		Table:      table,
	}
}

func payloadInt(payload map[string]interface{}, key string, def int) int {
	switch v := payload[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	default:
		return def
	}
}

func payloadStringMap(payload map[string]interface{}, key string) map[string]string {
	raw, _ := payload[key].(map[string]interface{})
	out := make(map[string]string, len(raw))
	for k, v := range raw {
		if s, ok := v.(string); ok {
			out[k] = s
		}
	}
	return out
}

func handleGetDBTableStructure(payload map[string]interface{}) {
	target := tableTargetFromPayload(payload)
	result := database.GetTableStructure(target)
	broadcastEvent("db_table_structure_sync", map[string]interface{}{
		"structure": result,
	})
}

func handleGetDBTableData(payload map[string]interface{}) {
	target := tableTargetFromPayload(payload)
	limit := payloadInt(payload, "limit", 50)
	offset := payloadInt(payload, "offset", 0)
	result := database.GetTableData(target, limit, offset)
	broadcastEvent("db_table_data_sync", map[string]interface{}{
		"data": result,
	})
}

func handleRunDBQuery(payload map[string]interface{}) {
	target := tableTargetFromPayload(payload)
	sqlText, _ := payload["sql"].(string)
	result := database.RunQuery(target, sqlText)
	broadcastEvent("db_query_sync", map[string]interface{}{
		"query": result,
	})
}

func handleMutateDBRow(payload map[string]interface{}) {
	target := tableTargetFromPayload(payload)
	operation, _ := payload["operation"].(string)
	values := payloadStringMap(payload, "values")
	keys := payloadStringMap(payload, "keys")
	result := database.MutateRow(target, operation, values, keys)
	broadcastEvent("db_row_mutation_sync", map[string]interface{}{
		"mutation": result,
	})
}
