use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub captcha_token: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterResponse {
    pub message: String,
}

impl RegisterResponse {
    pub fn success() -> Self {
        Self {
            message: "User registered".to_owned(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: String,
}

impl ErrorResponse {
    pub fn new(error: String) -> Self {
        Self { error }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeycloakUser {
    pub username: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    pub enabled: bool,
    pub email_verified: bool,
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub attributes: HashMap<String, Vec<String>>,
    pub credentials: Vec<KeycloakCredential>,
    #[serde(
        rename = "requiredActions",
        skip_serializing_if = "Vec::is_empty",
        default
    )]
    pub required_actions: Vec<String>,
}

impl KeycloakUser {
    pub fn from_request(request: &RegisterRequest) -> Self {
        let credentials = vec![KeycloakCredential {
            r#type: "password".to_owned(),
            temporary: false,
            value: request.password.clone(),
        }];

        let attributes = extract_attributes(&request.extra);

        Self {
            username: request.email.clone(),
            email: request.email.clone(),
            first_name: request.first_name.clone(),
            last_name: request.last_name.clone(),
            enabled: true,
            email_verified: false,
            attributes,
            credentials,
            required_actions: vec!["VERIFY_EMAIL".to_owned()],
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeycloakCredential {
    #[serde(rename = "type")]
    pub r#type: String,
    pub temporary: bool,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct TurnstileVerifyResponse {
    pub success: bool,
    #[serde(default, rename = "error-codes")]
    pub error_codes: Vec<String>,
}

fn extract_attributes(extra: &HashMap<String, Value>) -> HashMap<String, Vec<String>> {
    extra
        .iter()
        .filter_map(|(key, value)| {
            let values = match value {
                Value::String(text) => vec![text.trim().to_owned()],
                Value::Bool(flag) => vec![flag.to_string()],
                Value::Number(num) => vec![num.to_string()],
                Value::Array(items) => items
                    .iter()
                    .filter_map(|item| match item {
                        Value::String(text) => Some(text.trim().to_owned()),
                        Value::Bool(flag) => Some(flag.to_string()),
                        Value::Number(num) => Some(num.to_string()),
                        _ => None,
                    })
                    .filter(|text| !text.is_empty())
                    .collect::<Vec<_>>(),
                _ => Vec::new(),
            };

            if values.is_empty() {
                None
            } else {
                Some((key.clone(), values))
            }
        })
        .collect()
}
