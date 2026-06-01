# Config Template

Fill this template before first run or when channels/rules change.

```yaml
task_name: "多渠道帖子周汇总"

target_week:
  mode: "auto_minus_2_weeks" # or "manual"
  manual_range: "" # e.g. 2026-03-30~2026-04-05

source_tables:
  - channel: "渠道A"
    url: "https://..."
    publish_date_field: "发布日期"
  - channel: "渠道B"
    url: "https://..."
    publish_date_field: "发布日期"

weekly_table:
  url: "https://..."
  schema_columns:
    - "发布日期"
    - "平台"
    - "账号"
    - "帖子链接"
    - "标题"
    - "曝光"
    - "互动"
    - "周区间"
    - "汇总批次"
    - "临时标记"

premium_table:
  url: "https://..."

channel_field_mapping:
  渠道A:
    发布日期: "发布日期"
    平台: "平台"
    账号名称: "账号"
    链接: "帖子链接"
    标题: "标题"
    曝光量: "曝光"
    互动量: "互动"
  渠道B:
    日期: "发布日期"
    平台: "平台"
    达人账号: "账号"
    帖子URL: "帖子链接"
    内容标题: "标题"
    展示: "曝光"
    互动: "互动"

channel_color_map:
  # background-color only
  # semantic: premium | duplicate | normal
  渠道A:
    "rgb(255, 242, 204)": "premium"
    "rgb(244, 204, 204)": "duplicate"
  渠道B:
    "rgb(226, 239, 218)": "premium"
    "rgb(252, 213, 180)": "duplicate"

run_control:
  force_rerun: false
```

## Notes

1. Weekly table schema is authoritative.
2. Any unmapped source column is dropped.
3. Missing mapped source values are written as empty.
4. Unknown color rows are not silently processed; they become anomalies.
