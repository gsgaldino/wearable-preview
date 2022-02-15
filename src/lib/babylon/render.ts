import { AnimationGroup, TransformNode } from '@babylonjs/core'
import { WearableCategory } from '@dcl/schemas'
import { AvatarPreview, AvatarPreviewType } from '../avatar'
import { hasRepresentation } from '../representation'
import { Wearable } from '../wearable'
import { getBodyShape } from './body'
import { applyFacialFeatures, getFacialFeatures } from './face'
import { setupMappings } from './mappings'
import { Asset, center, createScene, loadAssetContainer, loadWearable } from './scene'
import { isFacialFeature, isModel, isSuccesful } from './utils'

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */
export async function render(canvas: HTMLCanvasElement, preview: AvatarPreview) {
  // create the root scene
  const root = await createScene(canvas, preview.zoom)

  // setup the mappings for all the contents
  setupMappings(preview.wearables, preview.bodyShape)

  // assembly wearables
  const catalog = new Map<WearableCategory, Wearable>()
  for (const wearable of preview.wearables) {
    const slot = wearable.data.category
    if (hasRepresentation(wearable, preview.bodyShape)) {
      catalog.set(slot, wearable)
    }
  }
  let hasSkin = false
  for (const wearable of catalog.values()) {
    const hidden = wearable.data.hides || []
    for (const slot of hidden) {
      catalog.delete(slot)
    }
    if (wearable.data.category === WearableCategory.SKIN) {
      hasSkin = true
    }
  }
  if (hasSkin) {
    catalog.delete(WearableCategory.HAIR)
    catalog.delete(WearableCategory.FACIAL_HAIR)
    catalog.delete(WearableCategory.MOUTH)
    catalog.delete(WearableCategory.EYEBROWS)
    catalog.delete(WearableCategory.EYES)
    catalog.delete(WearableCategory.UPPER_BODY)
    catalog.delete(WearableCategory.LOWER_BODY)
    catalog.delete(WearableCategory.FEET)
  }

  // load all the wearables into the root scene
  const promises: Promise<void | Asset>[] = []
  const wearables = Array.from(catalog.values())
  for (const wearable of wearables.filter(isModel)) {
    const promise = loadWearable(root, wearable, preview.bodyShape, preview.skin, preview.hair).catch((error) => {
      console.warn(error.message)
    })
    promises.push(promise)
  }
  const assets = (await Promise.all(promises)).filter(isSuccesful)

  console.log(assets)

  // add all assets to scene
  for (const asset of assets) {
    asset.container.addAllToScene()
  }

  if (preview.type === AvatarPreviewType.AVATAR) {
    // build avatar
    const bodyShape = getBodyShape(assets)
    const features = wearables.filter(isFacialFeature)
    const { eyes, eyebrows, mouth } = await getFacialFeatures(root, features, preview.bodyShape)
    applyFacialFeatures(root, bodyShape, eyes, eyebrows, mouth, preview)

    console.log(bodyShape)
    if (preview.emote) {
      const emote = await loadAssetContainer(root, `./emotes/${preview.emote}.glb`)
      console.log(emote)
      const avatarAnimation = new AnimationGroup('emote', root)
      for (const asset of assets) {
        console.log(asset.wearable.name)
        const nodes = asset.container.transformNodes.reduce((map, node) => map.set(node.id, node), new Map<string, TransformNode>())
        console.log(nodes)
        for (const targetedAnimation of emote.animationGroups[0].targetedAnimations) {
          const animation = targetedAnimation.animation
          const target = targetedAnimation.target as TransformNode
          const newTarget = nodes.get(target.id)
          if (!newTarget) {
            console.log('target not found', target.id, target, animation)
          } else {
            avatarAnimation.addTargetedAnimation(animation, newTarget)
          }
          // nodes.delete(target.id)
        }
        console.log(nodes)
      }
      avatarAnimation.loopAnimation = true
      avatarAnimation.normalize(1, 100)
      avatarAnimation.play()
    }
  }

  // center the root scene into the camera
  center(root)
}
