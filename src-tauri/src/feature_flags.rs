pub struct FeatureFlags;

impl FeatureFlags {
    #[allow(dead_code)]
    pub fn is_mcp_enabled() -> bool {
        return true;
        // match env::var("MCP_ENABLED") {
        //     Ok(val) => val.to_lowercase() == "true",
        //     Err(_) => false,
        // }
    }
}
