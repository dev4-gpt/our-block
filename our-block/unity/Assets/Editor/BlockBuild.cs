using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEditor.Build.Reporting;
public static class BlockBuild
{
 // Cloud Build calls this after compilation and before exporting a player.
 public static void PreExport(){
   var address=System.Environment.GetEnvironmentVariable("OUR_BLOCK_SERVER_URL");
   if(string.IsNullOrWhiteSpace(address)||!System.Uri.TryCreate(address,System.UriKind.Absolute,out var uri)||uri.Scheme!="wss"||uri.AbsolutePath!="/ws")throw new System.Exception("OUR_BLOCK_SERVER_URL must be the public wss://HOST/ws endpoint.");
   Directory.CreateDirectory("Assets/Resources");
   File.WriteAllText("Assets/Resources/ServerConfig.json",Newtonsoft.Json.JsonConvert.SerializeObject(new {server=address}));
   AssetDatabase.ImportAsset("Assets/Resources/ServerConfig.json");
   if(EditorUserBuildSettings.activeBuildTarget==BuildTarget.StandaloneOSX)PlayerSettings.SetArchitecture(UnityEditor.Build.NamedBuildTarget.Standalone,1);
   Prepare();
 }
 [MenuItem("OUR BLOCK/Prepare scene and URP")]
 public static void Prepare(){Directory.CreateDirectory("Assets/Resources");if(AssetDatabase.LoadAssetAtPath<Material>("Assets/Resources/BlockMaterial.mat")==null){var shader=Shader.Find("Universal Render Pipeline/Lit");if(shader==null)throw new System.Exception("URP Lit shader is unavailable.");AssetDatabase.CreateAsset(new Material(shader),"Assets/Resources/BlockMaterial.mat");}Directory.CreateDirectory("Assets/Settings");Directory.CreateDirectory("Assets/Scenes");var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/BlockPipeline.asset");if(pipeline==null){var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,"Assets/Settings/BlockRenderer.asset");pipeline=ScriptableObject.CreateInstance<UniversalRenderPipelineAsset>();var serialized=new SerializedObject(pipeline);var renderers=serialized.FindProperty("m_RendererDataList");renderers.arraySize=1;renderers.GetArrayElementAtIndex(0).objectReferenceValue=renderer;serialized.ApplyModifiedPropertiesWithoutUndo();AssetDatabase.CreateAsset(pipeline,"Assets/Settings/BlockPipeline.asset");}GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;PlayerSettings.companyName="Our Block";PlayerSettings.productName="OUR BLOCK";var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);var input=settings.FindProperty("activeInputHandler");if(input!=null){input.intValue=2;settings.ApplyModifiedPropertiesWithoutUndo();}var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);EditorSceneManager.SaveScene(scene,"Assets/Scenes/Town.unity");EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/Scenes/Town.unity",true)};AssetDatabase.SaveAssets();}
 [MenuItem("OUR BLOCK/Build macOS")]public static void Mac(){Build(BuildTarget.StandaloneOSX,"Builds/macOS/OurBlock.app");}
 [MenuItem("OUR BLOCK/Build Windows")]public static void Windows(){Build(BuildTarget.StandaloneWindows64,"Builds/Windows/OurBlock.exe");}
 static void Build(BuildTarget target,string path){Prepare();Directory.CreateDirectory(Path.GetDirectoryName(path));var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/Scenes/Town.unity"},target=target,locationPathName=path,options=BuildOptions.None});if(report.summary.result!=BuildResult.Succeeded)throw new System.Exception("OUR BLOCK build failed: "+report.summary.result);}
}
