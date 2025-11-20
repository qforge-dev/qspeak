use serde::{Deserialize, Serialize};
use strum_macros::EnumIter;

#[derive(Debug, Clone, Serialize, Deserialize, EnumIter, PartialEq, Eq)]
pub enum Language {
    #[serde(rename = "auto")]
    Auto,
    #[serde(rename = "ar")]
    Arabic,
    #[serde(rename = "zh")]
    Chinese,
    #[serde(rename = "nl")]
    Dutch,
    #[serde(rename = "en")]
    English,
    #[serde(rename = "fi")]
    Finnish,
    #[serde(rename = "fr")]
    French,
    #[serde(rename = "de")]
    German,
    #[serde(rename = "hi")]
    Hindi,
    #[serde(rename = "it")]
    Italian,
    #[serde(rename = "ja")]
    Japanese,
    #[serde(rename = "ko")]
    Korean,
    #[serde(rename = "no")]
    Norwegian,
    #[serde(rename = "pl")]
    Polish,
    #[serde(rename = "pt")]
    Portuguese,
    #[serde(rename = "pa")]
    Punjabi,
    #[serde(rename = "ro")]
    Romanian,
    #[serde(rename = "ru")]
    Russian,
    #[serde(rename = "es")]
    Spanish,
    #[serde(rename = "sv")]
    Swedish,
    #[serde(rename = "tr")]
    Turkish,
    #[serde(rename = "uk")]
    Ukrainian,
    #[serde(rename = "vi")]
    Vietnamese,
}

impl Language {
    pub fn to_str(&self) -> &str {
        match self {
            Language::Auto => "auto",
            Language::English => "en",
            Language::Arabic => "ar",
            Language::Chinese => "zh",
            Language::Dutch => "nl",
            Language::Finnish => "fi",
            Language::French => "fr",
            Language::German => "de",
            Language::Hindi => "hi",
            Language::Italian => "it",
            Language::Japanese => "ja",
            Language::Korean => "ko",
            Language::Norwegian => "no",
            Language::Polish => "pl",
            Language::Portuguese => "pt",
            Language::Punjabi => "pa",
            Language::Romanian => "ro",
            Language::Russian => "ru",
            Language::Spanish => "es",
            Language::Swedish => "sv",
            Language::Turkish => "tr",
            Language::Ukrainian => "uk",
            Language::Vietnamese => "vi",
        }
    }

    pub fn from_str(s: &str) -> Option<Language> {
        match s {
            "auto" => Some(Language::Auto),
            "en" => Some(Language::English),
            "ar" => Some(Language::Arabic),
            "zh" => Some(Language::Chinese),
            "nl" => Some(Language::Dutch),
            "fi" => Some(Language::Finnish),
            "fr" => Some(Language::French),
            "de" => Some(Language::German),
            "hi" => Some(Language::Hindi),
            "it" => Some(Language::Italian),
            "ja" => Some(Language::Japanese),
            "ko" => Some(Language::Korean),
            "no" => Some(Language::Norwegian),
            "pl" => Some(Language::Polish),
            "pt" => Some(Language::Portuguese),
            "pa" => Some(Language::Punjabi),
            "ro" => Some(Language::Romanian),
            "ru" => Some(Language::Russian),
            "es" => Some(Language::Spanish),
            "sv" => Some(Language::Swedish),
            "tr" => Some(Language::Turkish),
            "uk" => Some(Language::Ukrainian),
            "vi" => Some(Language::Vietnamese),
            _ => None,
        }
    }

    pub fn get_display_name(&self) -> &str {
        match self {
            Language::Auto => "Auto",
            Language::English => "English",
            Language::Arabic => "Arabic",
            Language::Chinese => "Chinese",
            Language::Dutch => "Dutch",
            Language::Finnish => "Finnish",
            Language::French => "French",
            Language::German => "German",
            Language::Hindi => "Hindi",
            Language::Italian => "Italian",
            Language::Japanese => "Japanese",
            Language::Korean => "Korean",
            Language::Norwegian => "Norwegian",
            Language::Polish => "Polish",
            Language::Portuguese => "Portuguese",
            Language::Punjabi => "Punjabi",
            Language::Romanian => "Romanian",
            Language::Russian => "Russian",
            Language::Spanish => "Spanish",
            Language::Swedish => "Swedish",
            Language::Turkish => "Turkish",
            Language::Ukrainian => "Ukrainian",
            Language::Vietnamese => "Vietnamese",
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum InterfaceTheme {
    Light,
    Dark,
}
